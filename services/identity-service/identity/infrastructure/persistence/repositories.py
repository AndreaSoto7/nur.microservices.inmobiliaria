from django.db import IntegrityError, transaction

from identity.domain.email import Email
from identity.domain.errors import EmailAlreadyRegistered
from identity.domain.repository import UserRepository
from identity.domain.user import User
from identity.infrastructure.persistence.mappers import to_model
from identity.infrastructure.persistence.models import UserModel


class DjangoUserRepository(UserRepository):
    def exists_with_email(self, email: Email) -> bool:
        return UserModel.objects.filter(email=email.value).exists()

    def add(self, user: User) -> None:
        try:
            # El savepoint deja usable la transacción externa si el INSERT falla.
            with transaction.atomic():
                to_model(user).save(force_insert=True)
        except IntegrityError as error:
            # Solo un email repetido es un error de negocio. Cualquier otra violación es un bug
            # y debe llegar como 500, no disfrazada de 409.
            if self.exists_with_email(user.email):
                raise EmailAlreadyRegistered("Ya existe un usuario con ese email.") from error
            raise
