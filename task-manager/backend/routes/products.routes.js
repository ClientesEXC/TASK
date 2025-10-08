const express = require('express');
const ctrl = require('../controllers/products.controller');
const { validate } = require('../middleware/validate');
const schema = require('../validators/products.schema');

const router = express.Router();

router.get(
    '/',
    validate({ query: schema.listQuery }),
    ctrl.list
);

router.get(
    '/:id',
    validate({ params: schema.idParam }),
    ctrl.getOne
);

router.post(
    '/',
    validate({ body: schema.createBody }),
    ctrl.create
);

router.patch(
    '/:id',
    validate({ params: schema.idParam, body: schema.updateBody }),
    ctrl.update
);

router.delete(
    '/:id',
    validate({ params: schema.idParam }),
    ctrl.remove
);

router.post(
    '/:id/restore',
    validate({ params: schema.idParam }),
    ctrl.restore
);

module.exports = router;
