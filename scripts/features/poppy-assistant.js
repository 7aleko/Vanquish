/**
 * Poppy Bot AI assistant sheet.
 */

// =========================================================================
// POPPY BOT AI ASSISTANT MODAL (DARK LUXURY APPLE INTELLIGENCE SHEET)
// =========================================================================
function openPoppyBotChat() {
    triggerHaptic('medium');
    if (typeof setPoppyOrbState === 'function') setPoppyOrbState('listening');

    openModal("", `
                <div class="space-y-4 py-1 select-none text-white">
                    <!-- Apple Intelligence Siri Orb Hero Stage -->
                    <div class="relative pt-1 pb-2 flex flex-col items-center justify-center text-center overflow-hidden">
                        <!-- Iridescent multi-layer caustic bloom -->
                        <div class="absolute w-56 h-56 rounded-full pointer-events-none opacity-70" 
                             style="background: radial-gradient(circle, rgba(34, 229, 98, 0.55) 0%, rgba(0, 240, 255, 0.40) 45%, rgba(16, 185, 129, 0.22) 70%, transparent 88%); filter: blur(34px);"></div>

                        <!-- Big 3D WebGL Assistant Orb (Lush Lime-Green & Emerald-Cyan) -->
                        <div class="relative w-52 h-52 flex items-center justify-center mb-1 overflow-visible">
                            <div class="siri-caustic-floor"></div>
                            <canvas id="modal-poppy-orb-canvas" width="256" height="256" class="w-[177px] h-[177px] pointer-events-none relative z-10 block rounded-full"></canvas>
                        </div>

                        <!-- Apple SF Pro Typography & Identity -->
                        <div class="space-y-1 relative z-10">
                            <div class="flex items-center justify-center gap-2">
                                <h3 class="text-2xl font-black text-white tracking-tight">Poppy Bot</h3>
                                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-lime/20 border border-brand-lime/40 text-[11px] font-black text-brand-lime uppercase tracking-wider shadow-2xs">
                                    <span class="w-1.5 h-1.5 rounded-full bg-brand-lime"></span> AI Assistant
                                </span>
                            </div>
                            <p class="text-xs text-slate-300 font-medium max-w-[310px] mx-auto leading-relaxed">
                                G'day Alexander! How can I assist with wet weather protocols, Procore specs, or site safety today?
                            </p>
                        </div>
                    </div>

                    <!-- Apple Intelligence Frosted Dark Glass Quick Action Cards -->
                    <div class="space-y-2">
                        <span class="text-[11px] font-black uppercase tracking-wider text-slate-400 block px-1">Suggested Actions</span>
                        <div class="grid grid-cols-2 gap-2 text-xs">
                            <button onclick="closeModal(); showToast('Poppy Bot', 'Checking weather & rain protocols for Bondi and Lugarno...');" 
                                    class="p-3.5 bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 text-white font-bold rounded-2xl text-left transition-all active:scale-[0.97] flex flex-col gap-1.5 cursor-pointer backdrop-blur-md group">
                                <div class="flex items-center justify-between w-full">
                                    <i class="fa-solid fa-cloud-rain text-lg text-[#AEB6C2]" aria-hidden="true"></i>
                                    <i class="fa-solid fa-arrow-up-right text-[11px] text-slate-400 group-hover:text-brand-lime transition-colors"></i>
                                </div>
                                <span class="text-xs font-black text-white tracking-tight">Rain Protocols</span>
                                <span class="text-[11px] text-slate-400 font-medium truncate">Bondi & Lugarno status</span>
                            </button>
                            <button onclick="closeModal(); showToast('Poppy Bot', 'Retrieving active Procore spec list...');" 
                                    class="p-3.5 bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 text-white font-bold rounded-2xl text-left transition-all active:scale-[0.97] flex flex-col gap-1.5 cursor-pointer backdrop-blur-md group">
                                <div class="flex items-center justify-between w-full">
                                    <i class="fa-solid fa-helmet-safety text-lg text-[#AEB6C2]" aria-hidden="true"></i>
                                    <i class="fa-solid fa-arrow-up-right text-[11px] text-slate-400 group-hover:text-brand-lime transition-colors"></i>
                                </div>
                                <span class="text-xs font-black text-white tracking-tight">Procore Specs</span>
                                <span class="text-[11px] text-slate-400 font-medium truncate">Active specifications</span>
                            </button>
                            <button onclick="closeModal(); showToast('Poppy Bot', 'Analyzing site pre-start safety checklist...');" 
                                    class="p-3.5 bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 text-white font-bold rounded-2xl text-left transition-all active:scale-[0.97] flex flex-col gap-1.5 cursor-pointer backdrop-blur-md group">
                                <div class="flex items-center justify-between w-full">
                                    <i class="fa-solid fa-clipboard-check text-lg text-[#AEB6C2]" aria-hidden="true"></i>
                                    <i class="fa-solid fa-arrow-up-right text-[11px] text-slate-400 group-hover:text-brand-lime transition-colors"></i>
                                </div>
                                <span class="text-xs font-black text-white tracking-tight">Safety Checklist</span>
                                <span class="text-[11px] text-slate-400 font-medium truncate">Pre-start verification</span>
                            </button>
                            <button onclick="closeModal(); showToast('Poppy Bot', 'Calculating roof pitch & setout specs...');" 
                                    class="p-3.5 bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 text-white font-bold rounded-2xl text-left transition-all active:scale-[0.97] flex flex-col gap-1.5 cursor-pointer backdrop-blur-md group">
                                <div class="flex items-center justify-between w-full">
                                    <i class="fa-solid fa-ruler text-lg text-[#AEB6C2]" aria-hidden="true"></i>
                                    <i class="fa-solid fa-arrow-up-right text-[11px] text-slate-400 group-hover:text-brand-lime transition-colors"></i>
                                </div>
                                <span class="text-xs font-black text-white tracking-tight">Setout Calculations</span>
                                <span class="text-[11px] text-slate-400 font-medium truncate">Roof pitch & setout</span>
                            </button>
                        </div>
                    </div>

                    <!-- Input Bar with Apple Frosted Pill Architecture -->
                    <div class="flex items-center gap-2 pt-1">
                        <div class="flex-1 relative flex items-center">
                            <i class="fa-solid fa-sparkles text-brand-lime text-xs absolute left-3.5 pointer-events-none"></i>
                            <input id="poppy-query-input" 
                                   type="text" 
                                   placeholder="Ask Poppy anything..." 
                                   onkeydown="if(event.key==='Enter') handlePoppySubmit()" 
                                   class="w-full bg-white/[0.08] border border-white/15 rounded-2xl pl-9 pr-4 py-3 text-xs text-white placeholder:text-slate-400 font-medium shadow-2xs focus:outline-none focus:bg-white/[0.12] focus:border-brand-lime focus:ring-2 focus:ring-brand-lime/25 transition-all">
                        </div>
                        <button onclick="handlePoppySubmit()" 
                                class="bg-brand-lime text-slate-950 hover:bg-brand-limeHover active:scale-95 px-5 py-3 rounded-2xl text-xs font-black shadow-[0_0_20px_rgba(34,229,98,0.35)] transition-all cursor-pointer shrink-0 flex items-center gap-1.5">
                            <span>Ask</span>
                            <i class="fa-solid fa-arrow-up text-[11px]"></i>
                        </button>
                    </div>
                </div>
            `);

    // Apply dark luxury glass styling to the modal container
    const content = document.getElementById('modal-content');
    if (content) content.classList.add('poppy-dark-modal');

    // The big orb in the sheet's hero: the same orb as Home's, kept between opens (scripts/components/siri-orb.js)
    mountPoppySheetOrb(document.getElementById('modal-poppy-orb-canvas'));
}

function openPoppyBotChatWithQuery(query) {
    openPoppyBotChat();
    setTimeout(() => {
        const input = document.getElementById('poppy-query-input');
        if (input) {
            input.value = query;
            input.focus();
        }
    }, 150);
}

function handlePoppySubmit() {
    const input = document.getElementById('poppy-query-input');
    const q = input ? input.value : '';
    if (typeof setPoppyOrbState === 'function') setPoppyOrbState('thinking');
    closeModal();
    showToast('Poppy Bot', q ? `Processing "${q}"...` : 'Query sent to Poppy');
    setTimeout(() => {
        if (typeof setPoppyOrbState === 'function') {
            setPoppyOrbState('done');
            setTimeout(() => setPoppyOrbState('idle'), 1600);
        }
    }, 1400);
}
