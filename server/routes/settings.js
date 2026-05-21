const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/settingsController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/parameters', authenticate, ctrl.getSystemParameters);
router.get('/datasets', authenticate, authorize('super_admin', 'admin'), ctrl.getDatasets);
router.post('/upload', authenticate, authorize('super_admin', 'admin'), ctrl.upload.array('files', 10), ctrl.uploadExcel);
router.get('/mappings/:datasetId', authenticate, authorize('super_admin', 'admin'), ctrl.getMappings);
router.put('/mappings/:id', authenticate, authorize('super_admin', 'admin'), ctrl.updateMapping);
router.put('/datasets/:datasetId/type', authenticate, authorize('super_admin', 'admin'), ctrl.updateDatasetType);
router.post('/validate/:datasetId', authenticate, authorize('super_admin', 'admin'), ctrl.validateDataset);
router.get('/download-mapped/:datasetId', authenticate, authorize('super_admin', 'admin'), ctrl.downloadMappedExcel);
router.post('/save-proceed/:datasetId', authenticate, authorize('super_admin', 'admin'), ctrl.saveAndProceed);
router.delete('/datasets/:datasetId', authenticate, authorize('super_admin', 'admin'), ctrl.deleteDataset);
router.post('/datasets/:datasetId/append', authenticate, authorize('super_admin', 'admin'), ctrl.upload.array('files', 10), ctrl.appendToDataset);
router.post('/api-integration', authenticate, authorize('super_admin', 'admin'), ctrl.saveApiIntegration);
router.get('/api-integrations', authenticate, authorize('super_admin', 'admin'), ctrl.getApiIntegrations);
router.post('/api-integrations/:id/fetch', authenticate, authorize('super_admin', 'admin'), ctrl.fetchAndActivateApi);
router.delete('/api-integrations/:id', authenticate, authorize('super_admin', 'admin'), ctrl.deleteApiIntegration);
router.post('/custom-param/calculate', authenticate, authorize('super_admin', 'admin'), ctrl.calculateCustomParam);
router.post('/custom-param/save', authenticate, authorize('super_admin', 'admin'), ctrl.saveCustomParam);
router.post('/integrate-api', authenticate, authorize('super_admin', 'admin'), ctrl.integrateExternalApi);

module.exports = router;