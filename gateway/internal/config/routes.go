package config

import (
	"net/http"
	"slices"
	"strings"
)

// Route es el destino de una request: un nombre de servicio en Consul, nunca una dirección fija.
type Route struct {
	Service string
	Public  bool
}

const (
	identityService     = "identity-service"
	listingService      = "listing-service"
	visitService        = "visit-service"
	auditService        = "audit-service"
	notificationService = "notification-service"

	authPrefix       = "/api/v1/auth"
	catalogPrefix    = "/api/v1/catalog"
	propertiesPrefix = "/api/v1/properties"
	jwksPath         = authPrefix + "/.well-known/jwks.json"

	// imagePathSegments cuenta el vacío inicial de /api/v1/properties/{id}/images/{imageId}.
	imagePathSegments = 7
	imagesSegmentAt   = 5
	// imageUploadSegments cuenta el vacío inicial de /api/v1/properties/{id}/images.
	imageUploadSegments = 6
)

// routeTable es la tabla de rutas de gateway/CLAUDE.md.
var routeTable = []struct{ prefix, service string }{
	{authPrefix, identityService},
	{"/api/v1/users", identityService},
	{propertiesPrefix, listingService},
	{"/api/v1/favorites", listingService},
	{catalogPrefix, listingService},
	{"/api/v1/inquiries", visitService},
	{"/api/v1/visits", visitService},
	{"/api/v1/leads", visitService},
	{"/api/v1/audit", auditService},
	{"/api/v1/notifications", notificationService},
}

// Se comparan de forma exacta: con un prefijo, /api/v1/auth/../users/me pasaría como pública.
var publicAuthPosts = []string{
	authPrefix + "/register",
	authPrefix + "/login",
	authPrefix + "/refresh",
	authPrefix + "/logout",
}

// Resolve busca la ruta. path debe haber pasado ValidPath.
func Resolve(method, path string) (Route, bool) {
	for _, entry := range routeTable {
		if underPrefix(path, entry.prefix) {
			return Route{Service: entry.service, Public: isPublic(method, path)}, true
		}
	}
	return Route{}, false
}

// Services devuelve los servicios de la tabla, los que discovery debe consultar.
func Services() []string {
	services := make([]string, 0, len(routeTable))
	for _, entry := range routeTable {
		services = append(services, entry.service)
	}
	slices.Sort(services)
	return slices.Compact(services)
}

// ValidPath rechaza lo que un servicio podría interpretar distinto que el gateway. Si no, un path que
// aquí parece público llegaría al servicio como otra ruta. Se evalúa sobre r.URL.Path ya decodificado,
// así que %2e%2e también se rechaza, y un "%" restante significa doble codificación.
func ValidPath(path string) bool {
	if path == "/" {
		return true
	}
	if !strings.HasPrefix(path, "/") || hasForbiddenCharacter(path) {
		return false
	}
	for segment := range strings.SplitSeq(path[1:], "/") {
		if segment == "" || segment == "." || segment == ".." {
			return false
		}
	}
	return true
}

// hasForbiddenCharacter: Tomcat trata ";" como parámetro de path ("..;" equivale a ".."), algunos
// servidores leen "\" como "/", y ninguna ruta de la API necesita caracteres de control.
func hasForbiddenCharacter(path string) bool {
	return strings.ContainsFunc(path, func(char rune) bool {
		return char == ';' || char == '\\' || char == '%' || char < ' ' || char == 0x7f
	})
}

// IsAuthPath indica si el path es de autenticación: bodies chicos y lectura con deadline.
func IsAuthPath(path string) bool {
	return underPrefix(path, authPrefix)
}

// IsImageUpload indica si es una subida a la galería, la única ruta con bodies grandes.
func IsImageUpload(method, path string) bool {
	if method != http.MethodPost || !underPrefix(path, propertiesPrefix) {
		return false
	}
	segments := strings.Split(path, "/")
	return len(segments) == imageUploadSegments && segments[imagesSegmentAt] == "images"
}

func isPublic(method, path string) bool {
	switch method {
	case http.MethodPost:
		return slices.Contains(publicAuthPosts, path)
	case http.MethodGet:
		return path == jwksPath || underPrefix(path, catalogPrefix) || isImagePath(path)
	default:
		return false
	}
}

func isImagePath(path string) bool {
	if !underPrefix(path, propertiesPrefix) {
		return false
	}
	segments := strings.Split(path, "/")
	return len(segments) == imagePathSegments && segments[imagesSegmentAt] == "images"
}

// underPrefix compara por segmentos: /api/v1/properties-falso no está bajo /api/v1/properties.
func underPrefix(path, prefix string) bool {
	return path == prefix || strings.HasPrefix(path, prefix+"/")
}
