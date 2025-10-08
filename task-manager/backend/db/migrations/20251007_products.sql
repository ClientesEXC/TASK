-- Productos robustos
CREATE TABLE IF NOT EXISTS products (
                                        id              SERIAL PRIMARY KEY,
                                        name            VARCHAR(120) NOT NULL,
    description     TEXT,
    price           NUMERIC(12,2) NOT NULL DEFAULT 0,
    stock_total     INT NOT NULL DEFAULT 0,
    stock_available INT NOT NULL DEFAULT 0,
    image_url       TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    version         INT NOT NULL DEFAULT 1,        -- optimistic locking
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP
    );

-- índices útiles
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at);

-- trigger para updated_at y version++
CREATE OR REPLACE FUNCTION products_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF TG_OP = 'UPDATE' THEN
    NEW.version = OLD.version + 1;
END IF;
RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'products_touch_tr') THEN
CREATE TRIGGER products_touch_tr
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE PROCEDURE products_touch();
END IF;
END $$;
