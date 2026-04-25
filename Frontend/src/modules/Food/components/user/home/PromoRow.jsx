import React from 'react';
import discountPromoIcon from "@food/assets/category-icons/discount_promo.png";
import vegPromoIcon from "@food/assets/category-icons/veg_promo.png";
import pricePromoIcon from "@food/assets/category-icons/price_promo.png";

export default function PromoRow({ handleVegModeChange, navigate, isVegMode, toggleRef }) {
  const promoCardsData = [
    {
      id: 'offers',
      title: "MIN.",
      value: "40% off",
      icon: discountPromoIcon,
      bgColor: "bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-950/40 dark:to-orange-950/20",
      borderColor: "border-rose-200/60 dark:border-rose-800/40",
      textColor: "text-rose-600 dark:text-rose-400",
      iconContainerColor: "bg-rose-500/10 dark:bg-rose-400/10",
    },
    {
      id: 'pure-veg',
      title: "PURE",
      value: "Veg",
      icon: vegPromoIcon,
      bgColor: "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/20",
      borderColor: "border-emerald-200/60 dark:border-emerald-800/40",
      textColor: "text-emerald-600 dark:text-emerald-400",
      iconContainerColor: "bg-emerald-500/10 dark:bg-emerald-400/10",
    },
    {
      id: 'under-250',
      title: "UNDER",
      value: "₹250",
      icon: pricePromoIcon,
      bgColor: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/20",
      borderColor: "border-amber-200/60 dark:border-amber-800/40",
      textColor: "text-amber-600 dark:text-amber-400",
      iconContainerColor: "bg-amber-500/10 dark:bg-amber-400/10",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 px-4 pt-4 pb-6 bg-white dark:bg-[#0a0a0a]">
      {promoCardsData.map((promo, idx) => (
        <div
          key={idx}
          ref={promo.id === 'pure-veg' ? toggleRef : null}
          className={`${promo.bgColor} ${promo.borderColor} rounded-[2rem] p-1.5 flex flex-col items-center h-[130px] shadow-sm border transition-all duration-300 cursor-pointer active:scale-95 group relative overflow-hidden ${
            promo.id === 'pure-veg' && isVegMode ? 'ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20' : ''
          }`}
          onClick={() => {
            if (promo.id === 'pure-veg') handleVegModeChange(!isVegMode);
            else if (promo.id === 'offers') navigate('/food/user/offers');
            else if (promo.id === 'under-250') navigate('/food/user/under-250');
          }}
        >
          {/* Subtle Glow Effect */}
          <div className={`absolute -top-10 -left-10 w-24 h-24 rounded-full mix-blend-multiply filter blur-2xl opacity-20 ${promo.bgColor}`} />
          
          <div className="py-2.5 px-1 flex flex-col items-center text-center relative z-10 w-full">
            <span className="text-[9px] font-black text-gray-400/80 dark:text-gray-500 tracking-[0.15em] uppercase leading-none mb-1">
              {promo.title}
            </span>
            <div className={`text-[12px] sm:text-[13px] font-black ${promo.textColor} leading-none truncate w-full px-1 flex items-center justify-center gap-0.5`}>
              {promo.value}
            </div>
          </div>

          <div className={`flex-1 w-full ${promo.iconContainerColor} backdrop-blur-sm rounded-[1.6rem] flex items-center justify-center p-2.5 mt-auto mb-1 overflow-hidden relative shadow-inner`}>
            <img
              src={promo.icon}
              alt={promo.value}
              className="w-full h-full object-contain drop-shadow-xl transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
