const fs = require('fs');
const path = 'admin/src/components/AddBuyerModal.tsx';
let content = fs.readFileSync(path, 'utf8');

// The problematic area
const problematicContent = `              </div>

              {/* Financial Terms Configurator */}`;

// What it should be
const fixedContent = `              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Allocate Stand</label>
                <div className="relative group">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-600 group-focus-within:text-primary-400 transition-colors" size={20} />
                  <select 
                    value={standId}
                    onChange={(e) => setStandId(e.target.value)}
                    className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all font-bold appearance-none cursor-pointer"
                    required
                  >
                    <option value="">Select a stand...</option>
                    {stands.map(s => (
                      <option key={s.id} value={s.id}>Stand {s.stand_number} ({s.size_sqm}m²)</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Financial Terms Configurator */}`;

content = content.replace(problematicContent, fixedContent);

fs.writeFileSync(path, content);
console.log("AddBuyerModal.tsx JSX fixed and field restored.");
