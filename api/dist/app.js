"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = __importDefault(require("./routes/auth"));
const projects_1 = __importDefault(require("./routes/projects"));
const buyers_1 = __importDefault(require("./routes/buyers"));
const pop_1 = __importDefault(require("./routes/pop"));
const documents_1 = __importDefault(require("./routes/documents"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const migration_1 = __importDefault(require("./routes/migration"));
const upload_1 = __importDefault(require("./routes/upload"));
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.method === 'POST')
        console.log('Body:', JSON.stringify(req.body, null, 2));
    next();
});
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
app.use('/auth', auth_1.default);
app.use('/projects', projects_1.default);
app.use('/buyers', buyers_1.default);
app.use('/pop', pop_1.default);
app.use('/documents', documents_1.default);
app.use('/notifications', notifications_1.default);
app.use('/migration', migration_1.default);
app.use('/upload', upload_1.default);
// Generic error handler
app.use((err, req, res, next) => {
    console.error('--- ERROR START ---');
    console.error(err);
    if (err.stack)
        console.error(err.stack);
    console.error('--- ERROR END ---');
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        details: err.code || undefined
    });
});
exports.default = app;
