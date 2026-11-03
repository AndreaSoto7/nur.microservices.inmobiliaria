"""Desarrollo local con `python manage.py runserver 8001`."""

from .base import *  # noqa: F403
from .base import env

DEBUG = env.bool("DJANGO_DEBUG", default=True)
