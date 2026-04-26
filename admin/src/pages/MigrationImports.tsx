import { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Upload
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useProject } from '../contexts/ProjectContext';

type FileKey = 'stands_csv' | 'purchasers_csv' | 'ledger_csv';

type ImportIssue = {
  level: 'error' | 'warning';
  section: 'stands' | 'purchasers' | 'ledger';
  row: number;
  field: string;
  message: string;
};

const fileLabels: Record<FileKey, { title: string; description: string }> = {
  stands_csv: {
    title: 'Stands CSV',
    description: 'Import available, reserved, sold, and allocated stands for the selected project.'
  },
  purchasers_csv: {
    title: 'Purchasers CSV',
    description: 'Import purchaser details and stand allocations.'
  },
  ledger_csv: {
    title: 'Ledger CSV',
    description: 'Import payments, charges, penalties, and reversals as historical ledger entries.'
  }
};

const sampleCsvTemplates: Record<FileKey, { filename: string; content: string }> = {
  stands_csv: {
    filename: 'stands_template.csv',
    content: [
      'project_name,stand_number,size_sqm,price_per_sqm,status',
      'Sunset Estate,A-101,300,45.00,AVAILABLE'
    ].join('\n')
  },
  purchasers_csv: {
    filename: 'purchasers_template.csv',
    content: [
      'project_name,stand_number,first_name,last_name,email,phone_number,id_number,allocation_date,legacy_customer_code,total_contract_price,payment_plan_months,monthly_instalment,deposit_amount',
      'Sunset Estate,A-101,John,Doe,john@example.com,+263771234567,12-345678-A-12,2025-11-01,CUST-001,13500.00,12,1000.00,1500.00'
    ].join('\n')
  },
  ledger_csv: {
    filename: 'ledger_template.csv',
    content: [
      'project_name,stand_number,purchaser_email,entry_type,amount,effective_date,description,is_verified,reference_number',
      'Sunset Estate,A-101,john@example.com,CHARGE,12000.00,2025-11-01,Opening contract balance,TRUE,OPEN-001',
      'Sunset Estate,A-101,john@example.com,PAYMENT,500.00,2025-12-05,Deposit paid,TRUE,RCPT-1001'
    ].join('\n')
  }
};

const MigrationImports = () => {
  const navigate = useNavigate();
  const { selectedProject } = useProject();
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const fileInputRefs = useRef<Record<FileKey, HTMLInputElement | null>>({
    stands_csv: null,
    purchasers_csv: null,
    ledger_csv: null
  });
  const [files, setFiles] = useState<Record<FileKey, { name: string; content: string }>>({
    stands_csv: { name: '', content: '' },
    purchasers_csv: { name: '', content: '' },
    ledger_csv: { name: '', content: '' }
  });
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [commitResult, setCommitResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [hasValidated, setHasValidated] = useState(false);

  const payload = useMemo(() => ({
    project_id: selectedProject?.id || '',
    stands_csv: files.stands_csv.content || undefined,
    purchasers_csv: files.purchasers_csv.content || undefined,
    ledger_csv: files.ledger_csv.content || undefined
  }), [files, selectedProject]);

  const hasFiles = Object.values(files).some((file) => file.content.trim());

  const handleFileChange = async (key: FileKey, file?: File) => {
    if (!file) return;
    const content = await file.text();
    setFiles((current) => ({
      ...current,
      [key]: {
        name: file.name,
        content
      }
    }));
    setReport(null);
    setCommitResult(null);
    setHasValidated(false);
  };

  const handleDownloadTemplate = async () => {
    const response = await api.get('/migration/template', {
      responseType: 'blob'
    });
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `migration_template_${selectedProject?.name || 'project'}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleDownloadCsvTemplate = (key: FileKey) => {
    const template = sampleCsvTemplates[key];
    const blob = new Blob([template.content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = template.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const getInviteBaseUrl = () => {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:5174/set-password`;
  };

  const scrollToResults = () => {
    window.requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleValidate = async () => {
    if (!selectedProject) return;
    setValidating(true);
    setError('');
    setCommitResult(null);
    setHasValidated(false);
    try {
      const response = await api.post('/migration/validate', payload);
      setReport(response.data);
      setHasValidated(true);
      scrollToResults();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Validation failed');
      setReport(err.response?.data?.report || null);
      setHasValidated(true);
      scrollToResults();
    } finally {
      setValidating(false);
    }
  };

  const handleCommit = async () => {
    if (!selectedProject) return;
    setCommitting(true);
    setError('');
    try {
      const response = await api.post('/migration/commit', {
        ...payload,
        invite_base_url: getInviteBaseUrl()
      });
      setCommitResult(response.data);
      setReport((current: any) => current || response.data);
      scrollToResults();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Import failed');
      const serverReport = err.response?.data?.report;
      if (serverReport) setReport(serverReport);
      scrollToResults();
    } finally {
      setCommitting(false);
    }
  };

  const issuesByLevel = useMemo(() => {
    const issues: ImportIssue[] = report?.issues || [];
    return {
      errors: issues.filter((issue) => issue.level === 'error'),
      warnings: issues.filter((issue) => issue.level === 'warning')
    };
  }, [report]);

  const validationErrorCount = report?.summary?.errors || 0;
  const canCommit = hasValidated && validationErrorCount === 0 && !validating && !committing;

  return (
    <div className="flex flex-col gap-8">
      {(validating || committing) && (
        <div className="fixed inset-0 z-50 bg-secondary-950/70 backdrop-blur-sm flex items-center justify-center">
          <div className="glass rounded-3xl p-8 border border-white/10 flex flex-col items-center gap-4 min-w-[280px]">
            <LoaderCircle size={30} className="animate-spin text-primary-400" />
            <div className="text-center">
              <p className="font-bold text-lg">{validating ? 'Running Dry Run Validation' : 'Importing Data'}</p>
              <p className="text-secondary-400 text-sm mt-1">
                {validating ? 'Checking duplicates, allocation conflicts, and data quality.' : 'Creating stands, purchasers, ledger entries, and buyer accounts.'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Migration Imports</h1>
          <p className="text-secondary-400 mt-1">Bring stands, purchasers, ledger history, and portal access into the selected project.</p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold transition-all"
        >
          <Download size={18} />
          Download Template
        </button>
      </div>

      {!selectedProject ? (
        <div className="glass rounded-2xl p-8 border border-orange-500/20 bg-orange-500/10 text-orange-300">
          Select a project first before preparing a migration import.
        </div>
      ) : (
        <>
          <div className="glass rounded-2xl p-5 border border-white/10">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-secondary-500">Selected Project</p>
            <h2 className="text-xl font-bold mt-2">{selectedProject.name}</h2>
            <p className="text-secondary-400 mt-1 text-sm">Load the three CSVs, run a dry run, then commit once the report is clean.</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {(Object.keys(fileLabels) as FileKey[]).map((key) => (
              <div key={key} className="glass rounded-2xl p-4 border border-white/10 flex flex-col gap-3 hover:border-primary-500/40 transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary-600/15 text-primary-400 flex items-center justify-center shrink-0">
                    <FileSpreadsheet size={18} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-sm">{fileLabels[key].title}</h3>
                    <p className="text-xs text-secondary-400 mt-1 leading-5">{fileLabels[key].description}</p>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleDownloadCsvTemplate(key);
                      }}
                      className="mt-2 inline-flex items-center gap-2 text-[11px] font-bold text-primary-400 hover:text-primary-300"
                    >
                      <Download size={14} />
                      Download sample CSV
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRefs.current[key]?.click()}
                  className="rounded-2xl border border-dashed border-white/10 bg-secondary-950/40 px-4 py-3 text-sm text-secondary-400 text-left hover:border-primary-500/40 hover:text-white transition-all"
                >
                  {files[key].name ? `Loaded: ${files[key].name}` : 'Choose a CSV file'}
                </button>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  ref={(node) => {
                    fileInputRefs.current[key] = node;
                  }}
                  onChange={(event) => handleFileChange(key, event.target.files?.[0])}
                />
              </div>
            ))}
          </div>

          <div className="glass rounded-2xl p-5 border border-white/10 flex flex-col gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-secondary-500">Portal Accounts</p>
              <p className="text-sm text-secondary-400 mt-1">Purchaser user accounts and invitation emails are created automatically when the import is committed.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleValidate}
                disabled={!selectedProject || !hasFiles || validating}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold transition-all disabled:opacity-50"
              >
                <Upload size={18} />
                {validating ? 'Validating...' : 'Dry Run Validation'}
              </button>
              {hasValidated && (
                <button
                  onClick={handleCommit}
                  disabled={!canCommit}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 rounded-xl font-bold transition-all text-white shadow-lg shadow-primary-600/20 disabled:opacity-50"
                >
                  <CheckCircle2 size={18} />
                  {committing ? 'Importing...' : 'Commit Import'}
                </button>
              )}
            </div>

            {hasValidated && (
              <div className={`rounded-2xl px-4 py-3 text-sm border ${validationErrorCount === 0 ? 'border-green-500/20 bg-green-500/10 text-green-300' : 'border-orange-500/20 bg-orange-500/10 text-orange-200'}`}>
                {validationErrorCount === 0
                  ? 'Dry run passed. Your data is clean and ready to import.'
                  : `Dry run found ${validationErrorCount} validation error${validationErrorCount === 1 ? '' : 's'}. Fix them before committing.`}
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-300 flex items-center gap-3">
                <AlertCircle size={18} />
                {error}
              </div>
            )}
          </div>

          {(report || commitResult) && (
            <div ref={resultsRef} className="flex flex-col gap-6">
              {report && (
                <>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="glass rounded-2xl p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary-500">Stands</p>
                  <p className="text-2xl font-bold mt-2">{report.summary?.stands || 0}</p>
                </div>
                <div className="glass rounded-2xl p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary-500">Purchasers</p>
                  <p className="text-2xl font-bold mt-2">{report.summary?.purchasers || 0}</p>
                </div>
                <div className="glass rounded-2xl p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary-500">Ledger</p>
                  <p className="text-2xl font-bold mt-2">{report.summary?.ledgerEntries || 0}</p>
                </div>
                <div className="glass rounded-2xl p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary-500">Errors</p>
                  <p className="text-2xl font-bold mt-2 text-red-400">{report.summary?.errors || 0}</p>
                </div>
                <div className="glass rounded-2xl p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary-500">Warnings</p>
                  <p className="text-2xl font-bold mt-2 text-orange-300">{report.summary?.warnings || 0}</p>
                </div>
                <div className="glass rounded-2xl p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary-500">Payments Total</p>
                  <p className="text-2xl font-bold mt-2">${Number(report.summary?.paymentsTotal || 0).toLocaleString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="glass rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/10 bg-white/5">
                    <h3 className="font-bold">Validation Errors</h3>
                  </div>
                  <div className="max-h-[360px] overflow-auto">
                    {issuesByLevel.errors.length === 0 ? (
                      <div className="p-6 text-secondary-400">No blocking errors found.</div>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-[0.22em] text-secondary-500 border-b border-white/10">
                            <th className="px-4 py-3">Section</th>
                            <th className="px-4 py-3">Row</th>
                            <th className="px-4 py-3">Field</th>
                            <th className="px-4 py-3">Message</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {issuesByLevel.errors.map((issue, index) => (
                            <tr key={`${issue.section}-${issue.row}-${issue.field}-${index}`}>
                              <td className="px-4 py-3 capitalize">{issue.section}</td>
                              <td className="px-4 py-3">{issue.row || '-'}</td>
                              <td className="px-4 py-3">{issue.field}</td>
                              <td className="px-4 py-3 text-red-300">{issue.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="glass rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/10 bg-white/5">
                    <h3 className="font-bold">Warnings</h3>
                  </div>
                  <div className="max-h-[360px] overflow-auto">
                    {issuesByLevel.warnings.length === 0 ? (
                      <div className="p-6 text-secondary-400">No warnings found.</div>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-[0.22em] text-secondary-500 border-b border-white/10">
                            <th className="px-4 py-3">Section</th>
                            <th className="px-4 py-3">Row</th>
                            <th className="px-4 py-3">Field</th>
                            <th className="px-4 py-3">Message</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {issuesByLevel.warnings.map((issue, index) => (
                            <tr key={`${issue.section}-${issue.row}-${issue.field}-${index}`}>
                              <td className="px-4 py-3 capitalize">{issue.section}</td>
                              <td className="px-4 py-3">{issue.row || '-'}</td>
                              <td className="px-4 py-3">{issue.field}</td>
                              <td className="px-4 py-3 text-orange-200">{issue.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {(['stands', 'purchasers', 'ledger'] as const).map((section) => (
                  <div key={section} className="glass rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/10 bg-white/5">
                      <h3 className="font-bold capitalize">{section} Preview</h3>
                    </div>
                    <pre className="p-6 text-xs text-secondary-300 overflow-auto whitespace-pre-wrap">
                      {JSON.stringify(report.preview?.[section] || [], null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
                </>
              )}

              {commitResult && (
                <div className="glass rounded-2xl overflow-hidden border border-green-500/20">
              <div className="px-6 py-4 border-b border-white/10 bg-green-500/10 flex items-center gap-3 text-green-300">
                <CheckCircle2 size={18} />
                Import completed successfully
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary-500">Stands Created</p>
                  <p className="text-2xl font-bold mt-2">{commitResult.results?.standsCreated || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary-500">Stands Updated</p>
                  <p className="text-2xl font-bold mt-2">{commitResult.results?.standsUpdated || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary-500">Purchasers Created</p>
                  <p className="text-2xl font-bold mt-2">{commitResult.results?.purchasersCreated || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary-500">Purchasers Updated</p>
                  <p className="text-2xl font-bold mt-2">{commitResult.results?.purchasersUpdated || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary-500">Ledger Imported</p>
                  <p className="text-2xl font-bold mt-2">{commitResult.results?.ledgerImported || 0}</p>
                </div>
              </div>

              <div className="border-t border-white/10 px-6 py-5 bg-white/5">
                <div className="mb-4 rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-green-300 text-sm">
                  Import outcome: {commitResult.results?.standsCreated || 0} stands created, {commitResult.results?.purchasersCreated || 0} purchasers created, {commitResult.results?.ledgerImported || 0} ledger entries imported, and buyer access emails processed automatically.
                </div>
                <h3 className="font-bold">Portal Invitation Status</h3>
                <p className="text-secondary-400 text-sm mt-1">Supabase invitation emails are issued automatically for imported purchasers who are new to authentication.</p>
                <div className="mt-4 flex flex-col gap-3">
                  {(commitResult.invitation_links || []).length === 0 ? (
                    <div className="text-secondary-400 text-sm">No invitation records were generated for this import.</div>
                  ) : (
                    (commitResult.invitation_links || []).map((invite: { buyer_id: string; email: string; supabase_user_id: string | null; invite_sent: boolean }) => (
                      <div key={invite.email} className="rounded-2xl border border-white/10 bg-secondary-950/40 px-4 py-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold">{invite.email}</p>
                            <p className="text-xs text-secondary-400 mt-1">
                              {invite.invite_sent ? 'Invitation email sent by Supabase.' : 'User already exists in Supabase Auth.'}
                            </p>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <button
                              onClick={() => navigate(`/buyers/${invite.buyer_id}`)}
                              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold"
                            >
                              Open Purchaser
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MigrationImports;
