-- Uso: psql -U postgres -v clave='LA_CLAVE' -f scripts/crear-base-datos.sql
CREATE ROLE soplate LOGIN PASSWORD :'clave' CREATEDB;
CREATE DATABASE soplate OWNER soplate;
CREATE DATABASE soplate_dev OWNER soplate;
