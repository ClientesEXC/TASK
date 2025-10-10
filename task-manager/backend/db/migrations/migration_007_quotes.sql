-- task-manager/backend/db/migrations/migration_007_quotes.sql

CREATE TABLE IF NOT EXISTS quotes (
                                      id               SERIAL PRIMARY KEY,
                                      type_service     VARCHAR(20) NOT NULL CHECK (type_service IN ('SOLO_CORTE', 'DISENADO')),
    materials        JSONB NOT NULL,            -- snapshot de materiales/dimensiones/elecciones
    include_print    BOOLEAN NOT NULL DEFAULT false,
    include_design   BOOLEAN NOT NULL DEFAULT false,
    design_level     VARCHAR(10),               -- FACIL | MEDIO | DIFICIL | NULL
    ojales_count     INTEGER,
    include_vinyl_cut BOOLEAN NOT NULL DEFAULT false,
    include_pvc_base  BOOLEAN NOT NULL DEFAULT false,
    pricing_snapshot JSONB,                     -- opcional: snapshot de precios usados
    details          JSONB NOT NULL,            -- renglones de la cotización (concepto, área, precio, costo)
    final_total      NUMERIC(10,2) NOT NULL,
    created_at       TIMESTAMP NOT NULL DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes (created_at DESC);
