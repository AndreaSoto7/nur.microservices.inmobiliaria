package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/application"
	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/domain"
	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/infrastructure/jwks"
)

const (
	userID         = "6f1c2a7e-1b2d-4c8e-9f10-5a6b7c8d9e01"
	notificationID = "7b1e4c2a-9d3f-4a6b-8c21-0f5e6d7c8b9a"
	listPath       = "/api/v1/notifications"
)

type fakeValidator struct{ err error }

func (f fakeValidator) Validate(context.Context, string) (string, error) { return userID, f.err }

type fakeList struct {
	page     application.NotificationPage
	err      error
	received application.ListNotificationsQuery
}

func (f *fakeList) Handle(_ context.Context, query application.ListNotificationsQuery) (application.NotificationPage, error) {
	f.received = query
	return f.page, f.err
}

type fakeMarkRead struct {
	err      error
	received application.MarkNotificationReadCommand
	calls    int
}

func (f *fakeMarkRead) Handle(_ context.Context, command application.MarkNotificationReadCommand) error {
	f.received = command
	f.calls++
	return f.err
}

type api struct {
	handler  http.Handler
	list     *fakeList
	markRead *fakeMarkRead
}

func newAPI(validator TokenValidator) *api {
	list, markRead := &fakeList{}, &fakeMarkRead{}
	return &api{
		list:     list,
		markRead: markRead,
		handler: NewRouter(Dependencies{
			Logger: slog.New(slog.DiscardHandler), Ready: alwaysReady,
			Validator: validator, List: list, MarkRead: markRead,
		}),
	}
}

func (a *api) do(method, target, body string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer token")
	for key, value := range headers {
		if value == "" {
			req.Header.Del(key)
			continue
		}
		req.Header.Set(key, value)
	}
	rec := httptest.NewRecorder()
	a.handler.ServeHTTP(rec, req)
	return rec
}

func assertProblem(t *testing.T, rec *httptest.ResponseRecorder, status int, code string) map[string]any {
	t.Helper()
	if rec.Code != status {
		t.Errorf("status = %d, want %d (%s)", rec.Code, status, rec.Body.String())
	}
	if got := rec.Header().Get("Content-Type"); got != "application/problem+json" {
		t.Errorf("Content-Type = %q", got)
	}
	body := decode(t, rec)
	if body["code"] != code {
		t.Errorf("code = %v, want %s", body["code"], code)
	}
	return body
}

func TestListRequiresAToken(t *testing.T) {
	tests := []struct {
		name   string
		header func(*http.Request)
	}{
		{"sin header", func(r *http.Request) { r.Header.Del("Authorization") }},
		{"esquema Basic", func(r *http.Request) { r.Header.Set("Authorization", "Basic abc") }},
		{"Bearer vacío", func(r *http.Request) { r.Header.Set("Authorization", "Bearer ") }},
		{"dos headers", func(r *http.Request) { r.Header.Add("Authorization", "Bearer otro") }},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := newAPI(fakeValidator{})
			req := httptest.NewRequest(http.MethodGet, listPath, nil)
			req.Header.Set("Authorization", "Bearer token")
			tt.header(req)
			rec := httptest.NewRecorder()

			a.handler.ServeHTTP(rec, req)

			assertProblem(t, rec, http.StatusUnauthorized, "AUTH_INVALID_TOKEN")
			if got := rec.Header().Get("WWW-Authenticate"); got != "Bearer" {
				t.Errorf("WWW-Authenticate = %q", got)
			}
		})
	}
}

func TestInvalidTokenResponds401(t *testing.T) {
	a := newAPI(fakeValidator{err: fmt.Errorf("%w: vencido", jwks.ErrInvalidToken)})

	rec := a.do(http.MethodGet, listPath, "", nil)

	assertProblem(t, rec, http.StatusUnauthorized, "AUTH_INVALID_TOKEN")
	if a.list.received.UserID != "" {
		t.Error("llegó al caso de uso")
	}
}

// Un 401 le diría al cliente que su sesión venció, y el problema es que identity no responde.
func TestUnavailableKeysRespond503(t *testing.T) {
	a := newAPI(fakeValidator{err: fmt.Errorf("validar: %w", jwks.ErrKeysUnavailable)})

	assertProblem(t, a.do(http.MethodGet, listPath, "", nil), http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE")
}

// El usuario sale siempre del token: ningún header ni parámetro del cliente puede cambiarlo.
func TestListUsesTheUserFromTheToken(t *testing.T) {
	a := newAPI(fakeValidator{})

	a.do(http.MethodGet, listPath+"?userId=otro&recipientId=otro", "", map[string]string{"X-User-Id": "otro"})

	if a.list.received.UserID != userID {
		t.Errorf("UserID = %q", a.list.received.UserID)
	}
}

func TestListDefaultsAndParameters(t *testing.T) {
	tests := []struct {
		target     string
		page, size int
		unread     bool
	}{
		{listPath, 1, 20, false},
		{listPath + "?page=3&size=50", 3, 50, false},
		{listPath + "?unread=true", 1, 20, true},
		{listPath + "?unread=false", 1, 20, false},
		{listPath + "?size=100", 1, 100, false},
	}

	for _, tt := range tests {
		t.Run(tt.target, func(t *testing.T) {
			a := newAPI(fakeValidator{})

			a.do(http.MethodGet, tt.target, "", nil)

			got := a.list.received
			if got.Page != tt.page || got.Size != tt.size || got.UnreadOnly != tt.unread {
				t.Errorf("query = %+v", got)
			}
		})
	}
}

func TestListRejectsInvalidParameters(t *testing.T) {
	tests := []struct {
		target, field string
	}{
		{"?page=abc", "page"},
		{"?page=0", "page"},
		// (page-1)*size desbordaría y daría un OFFSET negativo: un usuario podría provocar 500 a voluntad.
		{"?page=9223372036854775807&size=2", "page"},
		{"?page=1000001", "page"},
		{"?size=abc", "size"},
		{"?size=0", "size"},
		{"?size=101", "size"},
		{"?unread=quizas", "unread"},
	}

	for _, tt := range tests {
		t.Run(tt.target, func(t *testing.T) {
			a := newAPI(fakeValidator{})

			body := assertProblem(t, a.do(http.MethodGet, listPath+tt.target, "", nil), http.StatusBadRequest, "VALIDATION_ERROR")

			errorsField, _ := body["errors"].([]any)
			if len(errorsField) != 1 {
				t.Fatalf("errors = %v", body["errors"])
			}
			first, _ := errorsField[0].(map[string]any)
			if first["field"] != tt.field {
				t.Errorf("field = %v, want %s", first["field"], tt.field)
			}
		})
	}
}

func TestListResponseShape(t *testing.T) {
	a := newAPI(fakeValidator{})
	created := time.Date(2026, 10, 16, 14, 30, 0, 0, time.UTC)
	read := created.Add(time.Hour)
	a.list.page = application.NotificationPage{
		Items: []application.NotificationView{
			{ID: notificationID, Type: "VISIT_REQUESTED", Message: "m", PropertyID: "p", VisitID: "v", CreatedAt: created, ReadAt: &read},
			{ID: "otro", Type: "WELCOME", Message: "m", CreatedAt: created},
		},
		Number: 1, Size: 20, TotalElements: 2, TotalPages: 1,
	}

	rec := a.do(http.MethodGet, listPath, "", nil)

	if rec.Code != http.StatusOK || !strings.HasPrefix(rec.Header().Get("Content-Type"), "application/json") {
		t.Fatalf("status = %d, Content-Type = %q", rec.Code, rec.Header().Get("Content-Type"))
	}
	var body struct {
		Data []map[string]any `json:"data"`
		Page map[string]any   `json:"page"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	first := body.Data[0]
	want := map[string]any{
		"id": notificationID, "type": "VISIT_REQUESTED", "message": "m", "propertyId": "p", "visitId": "v",
		"createdAt": "2026-10-16T14:30:00Z", "readAt": "2026-10-16T15:30:00Z",
	}
	for key, value := range want {
		if first[key] != value {
			t.Errorf("%s = %v, want %v", key, first[key], value)
		}
	}
	second := body.Data[1]
	for _, key := range []string{"propertyId", "visitId", "readAt"} {
		if value, present := second[key]; !present || value != nil {
			t.Errorf("%s = %v (presente: %v), want null", key, value, present)
		}
	}
	if body.Page["number"] != float64(1) || body.Page["size"] != float64(20) || body.Page["totalElements"] != float64(2) || body.Page["totalPages"] != float64(1) {
		t.Errorf("page = %v", body.Page)
	}
}

func TestEmptyListIsAnEmptyArray(t *testing.T) {
	a := newAPI(fakeValidator{})

	rec := a.do(http.MethodGet, listPath, "", nil)

	if !strings.Contains(rec.Body.String(), `"data":[]`) {
		t.Errorf("body = %s", rec.Body.String())
	}
}

func TestMarkRead(t *testing.T) {
	a := newAPI(fakeValidator{})

	rec := a.do(http.MethodPatch, listPath+"/"+notificationID, `{"read":true}`, map[string]string{"Content-Type": "application/json"})

	if rec.Code != http.StatusNoContent || rec.Body.Len() != 0 {
		t.Errorf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	want := application.MarkNotificationReadCommand{NotificationID: notificationID, UserID: userID}
	if a.markRead.received != want {
		t.Errorf("comando = %+v", a.markRead.received)
	}
}

func TestMarkReadNormalizesTheID(t *testing.T) {
	a := newAPI(fakeValidator{})

	rec := a.do(http.MethodPatch, listPath+"/"+strings.ToUpper(notificationID), `{"read":true}`, nil)

	if rec.Code != http.StatusNoContent || a.markRead.received.NotificationID != notificationID {
		t.Errorf("status = %d, id = %q", rec.Code, a.markRead.received.NotificationID)
	}
}

func TestMarkReadRejectsInvalidRequests(t *testing.T) {
	tests := []struct {
		name, id, body, field string
	}{
		{"id que no es UUID", "abc", `{"read":true}`, "notificationId"},
		// uuid.Validate los acepta y PostgreSQL no: terminarían en un 500.
		{"id con prefijo urn", "urn:uuid:" + notificationID, `{"read":true}`, "notificationId"},
		{"id sin guiones", "7b1e4c2a9d3f4a6b8c210f5e6d7c8b9a", `{"read":true}`, "notificationId"},
		{"read en false", notificationID, `{"read":false}`, "read"},
		{"sin read", notificationID, `{}`, "read"},
		{"read de otro tipo", notificationID, `{"read":"true"}`, "read"},
		{"campo desconocido", notificationID, `{"read":true,"recipientId":"otro"}`, "read"},
		{"JSON ilegible", notificationID, `{`, "read"},
		{"body demasiado grande", notificationID, `{"read":true,"x":"` + strings.Repeat("a", 2<<10) + `"}`, "read"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := newAPI(fakeValidator{})

			body := assertProblem(t, a.do(http.MethodPatch, listPath+"/"+tt.id, tt.body, nil), http.StatusBadRequest, "VALIDATION_ERROR")

			if a.markRead.calls != 0 {
				t.Error("llegó al caso de uso")
			}
			errorsField, _ := body["errors"].([]any)
			if len(errorsField) != 1 {
				t.Fatalf("errors = %v", body["errors"])
			}
			first, _ := errorsField[0].(map[string]any)
			if first["field"] != tt.field {
				t.Errorf("field = %v, want %s", first["field"], tt.field)
			}
		})
	}
}

func TestMarkReadOfUnknownOrForeignNotificationResponds404(t *testing.T) {
	a := newAPI(fakeValidator{})
	a.markRead.err = domain.ErrNotificationNotFound

	body := assertProblem(t, a.do(http.MethodPatch, listPath+"/"+notificationID, `{"read":true}`, nil), http.StatusNotFound, "NOTIFICATION_NOT_FOUND")

	if body["type"] != "https://inmobiliaria.local/problems/notification-not-found" {
		t.Errorf("type = %v", body["type"])
	}
}

func TestUnexpectedErrorsDoNotLeakDetails(t *testing.T) {
	a := newAPI(fakeValidator{})
	a.list.err = errors.New("detalle interno de la base")
	a.markRead.err = errors.New("detalle interno de la base")

	for _, rec := range []*httptest.ResponseRecorder{
		a.do(http.MethodGet, listPath, "", nil),
		a.do(http.MethodPatch, listPath+"/"+notificationID, `{"read":true}`, nil),
	} {
		assertProblem(t, rec, http.StatusInternalServerError, "INTERNAL_ERROR")
		if strings.Contains(rec.Body.String(), "detalle interno") {
			t.Errorf("body = %s", rec.Body.String())
		}
	}
}

func TestHealthDoesNotRequireAToken(t *testing.T) {
	a := newAPI(fakeValidator{err: jwks.ErrInvalidToken})

	rec := a.do(http.MethodGet, "/health", "", map[string]string{"Authorization": ""})

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d", rec.Code)
	}
}
