import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, ChevronRight, Info, CheckCircle2 } from 'lucide-react';
import AnimatedPage from "@food/components/user/AnimatedPage";

export default function TableCancellationPolicy() {
    const navigate = useNavigate();
    const location = useLocation();
    const { restaurant, guests, date, timeSlot, discount, specialRequest, user } = location.state || {};

    const handleBack = () => {
        navigate("/food/user/dining/book-confirmation", { 
            state: { restaurant, guests, date, timeSlot, discount, specialRequest, user },
            replace: true
        });
    };

    return (
        <AnimatedPage className="min-h-screen bg-[#f8f9fa] pb-20">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
                <div className="max-w-lg mx-auto px-4 h-16 flex items-center gap-4">
                    <button onClick={handleBack} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-900 active:scale-90 transition-all">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">Cancellation</h1>
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
                {/* Hero Card */}
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 text-center space-y-4">
                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                        <ShieldCheck className="w-10 h-10" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">Cancellation Policy</h2>
                        <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-2 px-4">Standard dining terms apply to your booking</p>
                    </div>
                </div>

                {/* Deadline Card */}
                <div className="bg-red-500 rounded-3xl p-6 text-white shadow-xl shadow-red-200">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0">
                            <Info className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-red-100 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Cancellation Deadline</p>
                            <p className="text-lg font-bold">Valid till {timeSlot}, today</p>
                            <p className="text-xs text-red-100/80 mt-1 font-medium italic">You can cancel for free before this time.</p>
                        </div>
                    </div>
                </div>

                {/* Terms List */}
                <div className="space-y-4 pt-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Detailed Terms</p>
                    <div className="bg-white rounded-3xl divide-y divide-slate-50 border border-slate-100 overflow-hidden shadow-sm">
                        {[
                            { title: "Full Refund", desc: "100% refund if cancelled before the deadline.", icon: <CheckCircle2 className="w-4 h-4 text-green-500" /> },
                            { title: "Processing Time", desc: "Refunds reach your original payment method in 5-7 days.", icon: <CheckCircle2 className="w-4 h-4 text-green-500" /> },
                            { title: "No Show Policy", desc: "Refuds are not applicable if you don't arrive within 15 mins of your slot.", icon: <Info className="w-4 h-4 text-amber-500" /> },
                            { title: "Late Cancellation", desc: "50% charge applicable if cancelled after the deadline.", icon: <Info className="w-4 h-4 text-amber-500" /> }
                        ].map((item, i) => (
                            <div key={i} className="p-5 flex items-start gap-4 hover:bg-slate-50/50 transition-colors">
                                <div className="mt-1">{item.icon}</div>
                                <div>
                                    <p className="font-bold text-slate-900 text-sm">{item.title}</p>
                                    <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="pt-6">
                    <button 
                        onClick={handleBack}
                        className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-slate-200 active:scale-95 transition-all"
                    >
                        I Understand
                    </button>
                    <p className="text-center text-[10px] text-slate-400 font-bold mt-6 uppercase tracking-widest leading-loose">
                        By using Foodelo dining, you agree to our <br />
                        <span className="text-slate-900 underline underline-offset-4">Terms of Service</span>
                    </p>
                </div>
            </div>
        </AnimatedPage>
    );
}
