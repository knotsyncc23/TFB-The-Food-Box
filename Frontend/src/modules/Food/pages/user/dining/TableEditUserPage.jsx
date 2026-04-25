import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, User, Phone, Mail, CheckCircle2 } from 'lucide-react';
import AnimatedPage from "@food/components/user/AnimatedPage";

export default function TableEditUserPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, restaurant, guests, date, timeSlot, discount, specialRequest } = location.state || {};
    
    const [name, setName] = useState(user?.name || "");
    const [phone, setPhone] = useState(user?.phone || "");

    const handleSave = () => {
        // Go back to confirmation with updated user
        navigate("/food/user/dining/book-confirmation", {
            state: {
                restaurant,
                guests,
                date,
                timeSlot,
                discount,
                specialRequest,
                user: { ...user, name, phone }
            },
            replace: true
        });
    };

    return (
        <AnimatedPage className="min-h-screen bg-[#f8f9fa] pb-20">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
                <div className="max-w-lg mx-auto px-4 h-16 flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-900 active:scale-90 transition-all">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">Edit Details</h1>
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 py-8 space-y-8">
                <div className="text-center space-y-2">
                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-xl shadow-red-100">
                        <User className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900">Personalize Booking</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em]">Contact details for the restaurant</p>
                </div>

                <div className="space-y-6">
                    {/* Name Input */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Full Name</label>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                <User className="w-5 h-5" />
                            </div>
                            <input 
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your full name"
                                className="w-full h-14 pl-12 pr-4 bg-white border border-slate-100 rounded-2xl font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-red-500/5 focus:border-red-500 transition-all placeholder:text-slate-300 shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Phone Input */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Mobile Number</label>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                <Phone className="w-5 h-5" />
                            </div>
                            <input 
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="Enter mobile number"
                                className="w-full h-14 pl-12 pr-4 bg-white border border-slate-100 rounded-2xl font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-red-500/5 focus:border-red-500 transition-all placeholder:text-slate-300 shadow-sm"
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-10">
                    <button 
                        onClick={handleSave}
                        className="w-full h-14 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-red-200 active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                        <CheckCircle2 className="w-5 h-5" />
                        Save Changes
                    </button>
                    <button 
                        onClick={() => navigate(-1)}
                        className="w-full h-14 mt-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-sm active:scale-95 transition-all"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </AnimatedPage>
    );
}
