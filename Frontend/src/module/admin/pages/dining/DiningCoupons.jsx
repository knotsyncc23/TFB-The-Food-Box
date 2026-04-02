import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Search, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Loader2 } from "lucide-react";
import { adminAPI } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function DiningCoupons() {
  const location = useLocation();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    code: "",
    discountType: "percentage",
    discountValue: "",
    maxDiscount: "",
    minBillAmount: "",
    expiryDate: "",
    isActive: true,
    usageLimit: "",
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const normalizedSearch = search.replace(/\s+/g, "").trim();
      const res = await adminAPI.getDiningCoupons({ search: normalizedSearch || undefined, limit: 100 });
      if (res.data?.success && res.data?.data?.data) setList(res.data.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load coupons");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const modalParam = params.get("modal");
    if (modalParam === "create") {
      openCreate();
    }
  }, [location.search]);

  const openCreate = () => {
    setForm({
      code: "",
      discountType: "percentage",
      discountValue: "",
      maxDiscount: "",
      minBillAmount: "",
      expiryDate: "",
      isActive: true,
      usageLimit: "",
    });
    setModal("create");
  };

  const openEdit = (coupon) => {
    setForm({
      code: coupon.code || "",
      discountType: coupon.discountType || "percentage",
      discountValue: coupon.discountValue ?? "",
      maxDiscount: coupon.maxDiscount ?? "",
      minBillAmount: coupon.minBillAmount ?? "",
      expiryDate: coupon.expiryDate ? new Date(coupon.expiryDate).toISOString().slice(0, 10) : "",
      isActive: coupon.isActive !== false,
      usageLimit: coupon.usageLimit ?? "",
    });
    setModal({ type: "edit", coupon });
  };

  const handleSave = async () => {
    const code = String(form.code || "").trim();
    if (!code) {
      toast.error("Coupon code is required");
      return;
    }
    const discountValue = Number(form.discountValue);
    if (!Number.isFinite(discountValue) || discountValue < 0) {
      toast.error("Valid discount value is required");
      return;
    }
    if (!form.expiryDate) {
      toast.error("Expiry date is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: code.toUpperCase(),
        discountType: form.discountType,
        discountValue,
        maxDiscount: form.maxDiscount === "" ? null : Number(form.maxDiscount),
        minBillAmount: Number(form.minBillAmount) || 0,
        expiryDate: form.expiryDate,
        isActive: form.isActive,
        usageLimit: form.usageLimit === "" ? null : parseInt(form.usageLimit, 10),
      };
      if (modal === "create") {
        await adminAPI.createDiningCoupon(payload);
        toast.success("Coupon created");
      } else if (modal?.type === "edit") {
        await adminAPI.updateDiningCoupon(modal.coupon._id, payload);
        toast.success("Coupon updated");
      }
      setModal(null);
      fetchList();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this coupon?")) return;
    setDeletingId(id);
    try {
      await adminAPI.deleteDiningCoupon(id);
      toast.success("Coupon deleted");
      fetchList();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggle = async (id) => {
    setTogglingId(id);
    try {
      await adminAPI.toggleDiningCouponStatus(id);
      toast.success("Status updated");
      fetchList();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update");
    } finally {
      setTogglingId(null);
    }
  };

  const normalizedSearch = search.replace(/\s+/g, "").toLowerCase();
  const filteredList = normalizedSearch
    ? list.filter((c) => (c.code || "").replace(/\s+/g, "").toLowerCase().includes(normalizedSearch))
    : list;

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl font-bold text-slate-900">Dining Coupons</h1>
            <div className="flex gap-3">
              <div className="relative flex-1 sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value.replace(/^\s+/, ""))}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <Button onClick={openCreate} className="shrink-0">
                <Plus className="w-4 h-4 mr-2" />
                Add Coupon
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-20 text-slate-500">No dining coupons found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Code</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Type</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Value</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Min Bill</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Expiry</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Used</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredList.map((c) => (
                    <tr key={c._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-semibold">{c.code}</td>
                      <td className="px-4 py-3 text-sm">{c.discountType}</td>
                      <td className="px-4 py-3 text-sm">
                        {c.discountType === "percentage" ? `${c.discountValue}%` : `₹${c.discountValue}`}
                        {c.maxDiscount != null && c.maxDiscount > 0 && ` (max ₹${c.maxDiscount})`}
                      </td>
                      <td className="px-4 py-3 text-sm">₹{c.minBillAmount ?? 0}</td>
                      <td className="px-4 py-3 text-sm">{c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3 text-sm">{c.usedCount ?? 0}{c.usageLimit != null ? ` / ${c.usageLimit}` : ""}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggle(c._id)}
                          disabled={togglingId === c._id}
                          className="text-slate-600 hover:text-slate-900"
                        >
                          {togglingId === c._id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : c.isActive ? (
                            <ToggleRight className="w-6 h-6 text-red-600" title="Active" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-slate-400" title="Inactive" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => openEdit(c)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c._id)}
                          disabled={deletingId === c._id}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          {deletingId === c._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {(modal === "create" || modal?.type === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !saving && setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">{modal === "create" ? "Add Dining Coupon" : "Edit Coupon"}</h2>
              <button type="button" onClick={() => !saving && setModal(null)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                  placeholder="SAVE20"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select value={form.discountType} onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="percentage">Percentage</option>
                    <option value="flat">Flat</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Value</label>
                  <input
                    type="number"
                    min="0"
                    step={form.discountType === "percentage" ? 1 : 0.01}
                    value={form.discountValue}
                    onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max discount (₹)</label>
                  <input type="number" min="0" value={form.maxDiscount} onChange={(e) => setForm((p) => ({ ...p, maxDiscount: e.target.value }))} placeholder="Optional" className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Min bill (₹)</label>
                  <input type="number" min="0" value={form.minBillAmount} onChange={(e) => setForm((p) => ({ ...p, minBillAmount: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expiry date</label>
                  <input type="date" value={form.expiryDate} onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Usage limit</label>
                  <input type="number" min="0" value={form.usageLimit} onChange={(e) => setForm((p) => ({ ...p, usageLimit: e.target.value }))} placeholder="Unlimited" className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
                <span className="text-sm text-slate-700">Active</span>
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => !saving && setModal(null)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
