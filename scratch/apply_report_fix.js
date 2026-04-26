const fs = require('fs');
const path = 'admin/src/pages/Reports.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `                     <button 
                       onClick={() => fetchReport(activeReport)}
                       className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-secondary-400 hover:text-white active:rotate-180 duration-500"
                     >
                        <RefreshCw size={20} />
                     </button>`;

const replacement = `                     <button 
                       onClick={() => fetchReport(activeReport)}
                       className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-secondary-400 hover:text-white active:rotate-180 duration-500"
                     >
                        <RefreshCw size={20} />
                     </button>
                     
                     {['stand-registry', 'project-summary'].includes(activeReport) && (
                        <div className="flex items-center gap-2 ml-4">
                           <p className="text-[10px] font-black uppercase text-secondary-600 tracking-widest">Filter Status:</p>
                           <select 
                              value={statusFilter}
                              onChange={(e) => setStatusFilter(e.target.value)}
                              className="bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold outline-none text-white cursor-pointer"
                           >
                              <option value="ALL" className="bg-neutral-900">All Project Units</option>
                              <option value="AVAILABLE" className="bg-neutral-900">Available Stands</option>
                              <option value="SOLD" className="bg-neutral-900">Sold (Completed)</option>
                              <option value="ALLOCATED" className="bg-neutral-900">Allocated (In Progress)</option>
                           </select>
                        </div>
                     )}`;

// We use a more loose match to handle whitespace if needed, but let's try direct first.
if (!content.includes(target)) {
    console.log("Target not found directly. Trying regex...");
    const regex = /<button\s+onClick=\{\(\)\s+=>\s+fetchReport\(activeReport\)\}[\s\S]+?RefreshCw[\s\S]+?<\/button>/;
    content = content.replace(regex, (match) => {
        return match + `
                     
                     {['stand-registry', 'project-summary'].includes(activeReport) && (
                        <div className="flex items-center gap-2 ml-4">
                           <p className="text-[10px] font-black uppercase text-secondary-600 tracking-widest">Filter Status:</p>
                           <select 
                              value={statusFilter}
                              onChange={(e) => setStatusFilter(e.target.value)}
                              className="bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold outline-none text-white cursor-pointer"
                           >
                              <option value="ALL" className="bg-neutral-900">All Project Units</option>
                              <option value="AVAILABLE" className="bg-neutral-900">Available Stands</option>
                              <option value="SOLD" className="bg-neutral-900">Sold (Completed)</option>
                              <option value="ALLOCATED" className="bg-neutral-900">Allocated (In Progress)</option>
                           </select>
                        </div>
                     )}`;
    });
} else {
    content = content.replace(target, replacement);
}

fs.writeFileSync(path, content);
console.log("Edit applied successfully!");
