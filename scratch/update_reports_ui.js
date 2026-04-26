const fs = require('fs');
const path = 'admin/src/pages/Reports.tsx';
let content = fs.readFileSync(path, 'utf8');

// Target the filters area
const toolbarRegex = /\{(\['stand-registry', 'project-summary'\].includes\(activeReport\)) && \([\s\S]+?<\/div>\s+?)\}/;

const newToolbar = `{['stand-registry', 'project-summary'].includes(activeReport) && (
                        <div className="flex items-center gap-2 ml-4">
                           <p className="text-[10px] font-black uppercase text-secondary-600 tracking-widest">Status:</p>
                           <select 
                              value={statusFilter}
                              onChange={(e) => {
                                 setStatusFilter(e.target.value);
                                 fetchReport(activeReport);
                              }}
                              className="bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold outline-none text-white cursor-pointer"
                           >
                              <option value="ALL" className="bg-neutral-900">All Project Units</option>
                              <option value="AVAILABLE" className="bg-neutral-900">Available Stands</option>
                              <option value="SOLD" className="bg-neutral-900">Sold (Completed)</option>
                              <option value="ALLOCATED" className="bg-neutral-900">Allocated (In Progress)</option>
                           </select>
                        </div>
                     )}

                     <div className="flex items-center gap-2 ml-4 px-4 border-l border-white/10">
                        <p className="text-[10px] font-black uppercase text-secondary-600 tracking-widest">Period:</p>
                        <input 
                           type="date" 
                           value={startDate}
                           onChange={(e) => setStartDate(e.target.value)}
                           className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-primary-500"
                        />
                        <span className="text-secondary-600 text-[10px] font-black">TO</span>
                        <input 
                           type="date" 
                           value={endDate}
                           onChange={(e) => setEndDate(e.target.value)}
                           className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-primary-500"
                        />
                     </div>`;

content = content.replace(toolbarRegex, newToolbar);

fs.writeFileSync(path, content);
console.log("Reports.tsx UI updated with Date filters.");
