// Valida req.* con Joi schemas
const validate =
    (schemas = {}) =>
        (req, res, next) => {
            try {
                ['params', 'query', 'body'].forEach((key) => {
                    if (schemas[key]) {
                        const { error, value } = schemas[key].validate(req[key], {
                            abortEarly: false,
                            stripUnknown: true,
                            convert: true,
                        });
                        if (error) {
                            const err = new Error('Validación fallida');
                            err.status = 400;
                            err.details = error.details.map((d) => d.message);
                            throw err;
                        }
                        req[key] = value;
                    }
                });
                next();
            } catch (e) {
                next(e);
            }
        };

module.exports = { validate };
