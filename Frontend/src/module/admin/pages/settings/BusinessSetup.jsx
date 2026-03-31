import { useState, useRef, useEffect } from "react";
import { Info, Phone, Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@/lib/api";
import { clearCache, updateFavicon, updateTitle } from "@/lib/utils/businessSettings";

export default function BusinessSetup() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [logoPreview, setLogoPreview] = useState(null);
  const [faviconPreview, setFaviconPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [faviconFile, setFaviconFile] = useState(null);
  const logoInputRef = useRef(null);
  const faviconInputRef = useRef(null);

  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    phoneCountryCode: "+91",
    phoneNumber: "",
    address: "",
    state: "",
    pincode: "",
    region: "",
  });

  const formatText = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim();

  const formatEmail = (value) =>
    String(value || "")
      .replace(/\s+/g, "")
      .trim()
      .toLowerCase();

  const formatPhoneNumber = (value) =>
    String(value || "").replace(/[^\d]/g, "");

  const formatPincode = (value, region = formData.region) => {
    const raw = String(value || "").toUpperCase().replace(/\s+/g, "");
    if (region === "India") return raw.replace(/[^\d]/g, "").slice(0, 6);
    if (region === "US") return raw.replace(/[^0-9-]/g, "").slice(0, 10);
    return raw.replace(/[^A-Z0-9]/g, "").slice(0, 10);
  };

  const validateBusinessSettings = (data) => {
    const nextErrors = {};
    const companyName = formatText(data.companyName);
    const email = formatEmail(data.email);
    const phoneNumber = formatPhoneNumber(data.phoneNumber);
    const address = formatText(data.address);
    const state = formatText(data.state);
    const pincode = formatPincode(data.pincode, data.region);

    const companyNameRegex = /^[A-Za-z0-9][A-Za-z0-9 '&().,/-]*$/;
    const stateRegex = /^[A-Za-z][A-Za-z\s.'-]*$/;
    const addressRegex = /^[A-Za-z0-9][A-Za-z0-9\s,.'#&()/-]*$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!companyName) {
      nextErrors.companyName = "Company name is required";
    } else if (companyName.length < 2 || companyName.length > 120) {
      nextErrors.companyName = "Company name must be between 2 and 120 characters";
    } else if (!companyNameRegex.test(companyName)) {
      nextErrors.companyName = "Company name contains invalid characters";
    }

    if (!email) {
      nextErrors.email = "Email is required";
    } else if (!emailRegex.test(email)) {
      nextErrors.email = "Enter a valid email address";
    }

    if (!data.phoneCountryCode || !String(data.phoneCountryCode).startsWith("+")) {
      nextErrors.phoneCountryCode = "Select a valid country code";
    }

    if (!phoneNumber) {
      nextErrors.phoneNumber = "Phone number is required";
    } else if (phoneNumber.length < 7 || phoneNumber.length > 15) {
      nextErrors.phoneNumber = "Phone number must be 7 to 15 digits";
    }

    if (state && !stateRegex.test(state)) {
      nextErrors.state = "State should contain only letters and spaces";
    }

    if (address && !addressRegex.test(address)) {
      nextErrors.address = "Address contains invalid characters";
    }

    if (data.region === "India" && pincode && !/^\d{6}$/.test(pincode)) {
      nextErrors.pincode = "Indian pincode must be 6 digits";
    } else if (data.region === "US" && pincode && !/^\d{5}(-\d{4})?$/.test(pincode)) {
      nextErrors.pincode = "US ZIP code must be 5 digits or 5+4 format";
    } else if (data.region === "UK" && pincode && !/^[A-Z0-9]{5,8}$/.test(pincode)) {
      nextErrors.pincode = "UK postcode should be alphanumeric";
    }

    return {
      errors: nextErrors,
      normalized: {
        companyName,
        email,
        phoneCountryCode: String(data.phoneCountryCode || "").trim(),
        phoneNumber,
        address,
        state,
        pincode,
        region: data.region,
      },
    };
  };

  // Fetch business settings on mount
  useEffect(() => {
    fetchBusinessSettings();
  }, []);

  const fetchBusinessSettings = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getBusinessSettings();
      const settings = response?.data?.data || response?.data;

      if (settings) {
        setFormData({
          companyName: settings.companyName || "",
          email: settings.email || "",
          phoneCountryCode: settings.phone?.countryCode || "+91",
          phoneNumber: settings.phone?.number || "",
          address: settings.address || "",
          state: settings.state || "",
          pincode: settings.pincode || "",
          region: settings.region || "India",
        });

        // Set logo and favicon previews if they exist
        if (settings.logo?.url) {
          setLogoPreview(settings.logo.url);
        }
        if (settings.favicon?.url) {
          setFaviconPreview(settings.favicon.url);
        }
      }
    } catch (error) {
      console.error("Error fetching business settings:", error);
      toast.error(error?.response?.data?.message || "Failed to load business settings");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    let nextValue = value;

    if (field === "companyName" || field === "address" || field === "state") {
      nextValue = formatText(value);
    } else if (field === "email") {
      nextValue = formatEmail(value);
    } else if (field === "phoneNumber") {
      nextValue = formatPhoneNumber(value);
    } else if (field === "pincode") {
      nextValue = formatPincode(value, formData.region);
    }

    setFormData((prev) => ({
      ...prev,
      [field]: nextValue,
    }));

    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }));
  };

  const handleSave = async () => {
    try {
      const { errors: validationErrors, normalized } = validateBusinessSettings(formData);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        const firstError = Object.values(validationErrors)[0];
        toast.error(firstError || "Please fix the highlighted fields");
        return;
      }

      setSaving(true);
      setErrors({});

      // Prepare form data
      const dataToSend = {
        ...normalized,
      };

      // Prepare files
      const files = {};
      if (logoFile) {
        files.logo = logoFile;
      }
      if (faviconFile) {
        files.favicon = faviconFile;
      }

      const response = await adminAPI.updateBusinessSettings(dataToSend, files);
      const updatedSettings = response?.data?.data || response?.data;

      if (updatedSettings) {
        // Clear cache to force reload
        clearCache();

        // Update previews with new URLs if files were uploaded
        if (updatedSettings.logo?.url) {
          setLogoPreview(updatedSettings.logo.url);
          setLogoFile(null);
        }
        if (updatedSettings.favicon?.url) {
          setFaviconPreview(updatedSettings.favicon.url);
          setFaviconFile(null);
          // Update favicon in document
          updateFavicon(updatedSettings.favicon.url);
        }
        // Update page title
        if (updatedSettings.companyName) {
          updateTitle(updatedSettings.companyName);
        }
      }

      toast.success("Business settings saved successfully");

      // Dispatch event to notify other components (like AdminNavbar)
      window.dispatchEvent(new Event('businessSettingsUpdated'));
    } catch (error) {
      console.error("Error saving business settings:", error);
      toast.error(error?.response?.data?.message || "Failed to save business settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    fetchBusinessSettings();
    setLogoFile(null);
    setFaviconFile(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
    if (faviconInputRef.current) {
      faviconInputRef.current.value = "";
    }
    toast.info("Form reset to saved values");
  };


  if (loading) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Page header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Business setup</h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Manage your company information, general configuration and business rules.
          </p>
        </div>

        {/* Note card (top-right) */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3 max-w-md">
          <div className="mt-0.5">
            <Info className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xs lg:text-sm text-slate-700">
            <p className="font-semibold text-amber-700 mb-0.5">Note</p>
            <p>Don&apos;t forget to click the &quot;Save Information&quot; button below to save changes.</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Company info */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          {/* Company information */}
          <div className="px-4 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span>Company Information</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Company name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter Your Company Name"
                  value={formData.companyName}
                  onChange={(e) => handleInputChange("companyName", e.target.value)}
                  onBlur={() => handleInputChange("companyName", formData.companyName)}
                  className={`w-full px-3 py-2 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.companyName ? "border-red-400 focus:ring-red-500 focus:border-red-500" : "border-slate-300"}`}
                />
                {errors.companyName ? (
                  <p className="mt-1 text-[11px] text-red-600">{errors.companyName}</p>
                ) : null}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="Enter Your Email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  onBlur={() => handleInputChange("email", formData.email)}
                  className={`w-full px-3 py-2 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.email ? "border-red-400 focus:ring-red-500 focus:border-red-500" : "border-slate-300"}`}
                />
                {errors.email ? (
                  <p className="mt-1 text-[11px] text-red-600">{errors.email}</p>
                ) : null}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Region <span className="text-red-500">*</span>
                </label>
                  <select
                    value={formData.region}
                    onChange={(e) => {
                      const region = e.target.value;
                      handleInputChange("region", region);
                      setFormData((prev) => ({
                        ...prev,
                        pincode: formatPincode(prev.pincode, region),
                      }));
                    }}
                    className={`w-full px-3 py-2 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.region ? "border-red-400 focus:ring-red-500 focus:border-red-500" : "border-slate-300"}`}
                  >
                  <option value="India">India</option>
                  <option value="UK">UK</option>
                  <option value="US">US</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Phone <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative w-32">
                    <select
                      value={formData.phoneCountryCode}
                      onChange={(e) => handleInputChange("phoneCountryCode", e.target.value)}
                      className={`w-full pl-8 pr-6 py-2 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none ${errors.phoneCountryCode ? "border-red-400 focus:ring-red-500 focus:border-red-500" : "border-slate-300"}`}
                    >
                      <option value="+1">+1 (US/CA)</option>
                      <option value="+7">+7 (RU/KZ)</option>
                      <option value="+20">+20 (EG)</option>
                      <option value="+27">+27 (ZA)</option>
                      <option value="+30">+30 (GR)</option>
                      <option value="+31">+31 (NL)</option>
                      <option value="+32">+32 (BE)</option>
                      <option value="+33">+33 (FR)</option>
                      <option value="+34">+34 (ES)</option>
                      <option value="+36">+36 (HU)</option>
                      <option value="+39">+39 (IT)</option>
                      <option value="+40">+40 (RO)</option>
                      <option value="+41">+41 (CH)</option>
                      <option value="+43">+43 (AT)</option>
                      <option value="+44">+44 (GB)</option>
                      <option value="+45">+45 (DK)</option>
                      <option value="+46">+46 (SE)</option>
                      <option value="+47">+47 (NO)</option>
                      <option value="+48">+48 (PL)</option>
                      <option value="+49">+49 (DE)</option>
                      <option value="+51">+51 (PE)</option>
                      <option value="+52">+52 (MX)</option>
                      <option value="+53">+53 (CU)</option>
                      <option value="+54">+54 (AR)</option>
                      <option value="+55">+55 (BR)</option>
                      <option value="+56">+56 (CL)</option>
                      <option value="+57">+57 (CO)</option>
                      <option value="+58">+58 (VE)</option>
                      <option value="+60">+60 (MY)</option>
                      <option value="+61">+61 (AU)</option>
                      <option value="+62">+62 (ID)</option>
                      <option value="+63">+63 (PH)</option>
                      <option value="+64">+64 (NZ)</option>
                      <option value="+65">+65 (SG)</option>
                      <option value="+66">+66 (TH)</option>
                      <option value="+81">+81 (JP)</option>
                      <option value="+82">+82 (KR)</option>
                      <option value="+84">+84 (VN)</option>
                      <option value="+86">+86 (CN)</option>
                      <option value="+90">+90 (TR)</option>
                      <option value="+91">+91 (IN)</option>
                      <option value="+92">+92 (PK)</option>
                      <option value="+93">+93 (AF)</option>
                      <option value="+94">+94 (LK)</option>
                      <option value="+95">+95 (MM)</option>
                      <option value="+98">+98 (IR)</option>
                      <option value="+212">+212 (MA)</option>
                      <option value="+213">+213 (DZ)</option>
                      <option value="+216">+216 (TN)</option>
                      <option value="+218">+218 (LY)</option>
                      <option value="+220">+220 (GM)</option>
                      <option value="+221">+221 (SN)</option>
                      <option value="+222">+222 (MR)</option>
                      <option value="+223">+223 (ML)</option>
                      <option value="+224">+224 (GN)</option>
                      <option value="+225">+225 (CI)</option>
                      <option value="+226">+226 (BF)</option>
                      <option value="+227">+227 (NE)</option>
                      <option value="+228">+228 (TG)</option>
                      <option value="+229">+229 (BJ)</option>
                      <option value="+230">+230 (MU)</option>
                      <option value="+231">+231 (LR)</option>
                      <option value="+232">+232 (SL)</option>
                      <option value="+233">+233 (GH)</option>
                      <option value="+234">+234 (NG)</option>
                      <option value="+235">+235 (TD)</option>
                      <option value="+236">+236 (CF)</option>
                      <option value="+237">+237 (CM)</option>
                      <option value="+238">+238 (CV)</option>
                      <option value="+239">+239 (ST)</option>
                      <option value="+240">+240 (GQ)</option>
                      <option value="+241">+241 (GA)</option>
                      <option value="+242">+242 (CG)</option>
                      <option value="+243">+243 (CD)</option>
                      <option value="+244">+244 (AO)</option>
                      <option value="+245">+245 (GW)</option>
                      <option value="+246">+246 (IO)</option>
                      <option value="+248">+248 (SC)</option>
                      <option value="+249">+249 (SD)</option>
                      <option value="+250">+250 (RW)</option>
                      <option value="+251">+251 (ET)</option>
                      <option value="+252">+252 (SO)</option>
                      <option value="+253">+253 (DJ)</option>
                      <option value="+254">+254 (KE)</option>
                      <option value="+255">+255 (TZ)</option>
                      <option value="+256">+256 (UG)</option>
                      <option value="+257">+257 (BI)</option>
                      <option value="+258">+258 (MZ)</option>
                      <option value="+260">+260 (ZM)</option>
                      <option value="+261">+261 (MG)</option>
                      <option value="+262">+262 (RE)</option>
                      <option value="+263">+263 (ZW)</option>
                      <option value="+264">+264 (NA)</option>
                      <option value="+265">+265 (MW)</option>
                      <option value="+266">+266 (LS)</option>
                      <option value="+267">+267 (BW)</option>
                      <option value="+268">+268 (SZ)</option>
                      <option value="+269">+269 (KM)</option>
                      <option value="+290">+290 (SH)</option>
                      <option value="+291">+291 (ER)</option>
                      <option value="+297">+297 (AW)</option>
                      <option value="+298">+298 (FO)</option>
                      <option value="+299">+299 (GL)</option>
                      <option value="+350">+350 (GI)</option>
                      <option value="+351">+351 (PT)</option>
                      <option value="+352">+352 (LU)</option>
                      <option value="+353">+353 (IE)</option>
                      <option value="+354">+354 (IS)</option>
                      <option value="+355">+355 (AL)</option>
                      <option value="+356">+356 (MT)</option>
                      <option value="+357">+357 (CY)</option>
                      <option value="+358">+358 (FI)</option>
                      <option value="+359">+359 (BG)</option>
                      <option value="+370">+370 (LT)</option>
                      <option value="+371">+371 (LV)</option>
                      <option value="+372">+372 (EE)</option>
                      <option value="+373">+373 (MD)</option>
                      <option value="+374">+374 (AM)</option>
                      <option value="+375">+375 (BY)</option>
                      <option value="+376">+376 (AD)</option>
                      <option value="+377">+377 (MC)</option>
                      <option value="+378">+378 (SM)</option>
                      <option value="+380">+380 (UA)</option>
                      <option value="+381">+381 (RS)</option>
                      <option value="+382">+382 (ME)</option>
                      <option value="+383">+383 (XK)</option>
                      <option value="+385">+385 (HR)</option>
                      <option value="+386">+386 (SI)</option>
                      <option value="+387">+387 (BA)</option>
                      <option value="+389">+389 (MK)</option>
                      <option value="+420">+420 (CZ)</option>
                      <option value="+421">+421 (SK)</option>
                      <option value="+423">+423 (LI)</option>
                      <option value="+500">+500 (FK)</option>
                      <option value="+501">+501 (BZ)</option>
                      <option value="+502">+502 (GT)</option>
                      <option value="+503">+503 (SV)</option>
                      <option value="+504">+504 (HN)</option>
                      <option value="+505">+505 (NI)</option>
                      <option value="+506">+506 (CR)</option>
                      <option value="+507">+507 (PA)</option>
                      <option value="+508">+508 (PM)</option>
                      <option value="+509">+509 (HT)</option>
                      <option value="+590">+590 (GP)</option>
                      <option value="+591">+591 (BO)</option>
                      <option value="+592">+592 (GY)</option>
                      <option value="+593">+593 (EC)</option>
                      <option value="+594">+594 (GF)</option>
                      <option value="+595">+595 (PY)</option>
                      <option value="+596">+596 (MQ)</option>
                      <option value="+597">+597 (SR)</option>
                      <option value="+598">+598 (UY)</option>
                      <option value="+599">+599 (CW)</option>
                      <option value="+670">+670 (TL)</option>
                      <option value="+672">+672 (AQ)</option>
                      <option value="+673">+673 (BN)</option>
                      <option value="+674">+674 (NR)</option>
                      <option value="+675">+675 (PG)</option>
                      <option value="+676">+676 (TO)</option>
                      <option value="+677">+677 (SB)</option>
                      <option value="+678">+678 (VU)</option>
                      <option value="+679">+679 (FJ)</option>
                      <option value="+680">+680 (PW)</option>
                      <option value="+681">+681 (WF)</option>
                      <option value="+682">+682 (CK)</option>
                      <option value="+683">+683 (NU)</option>
                      <option value="+685">+685 (WS)</option>
                      <option value="+686">+686 (KI)</option>
                      <option value="+687">+687 (NC)</option>
                      <option value="+688">+688 (TV)</option>
                      <option value="+689">+689 (PF)</option>
                      <option value="+850">+850 (KP)</option>
                      <option value="+852">+852 (HK)</option>
                      <option value="+853">+853 (MO)</option>
                      <option value="+855">+855 (KH)</option>
                      <option value="+856">+856 (LA)</option>
                      <option value="+880">+880 (BD)</option>
                      <option value="+886">+886 (TW)</option>
                      <option value="+960">+960 (MV)</option>
                      <option value="+961">+961 (LB)</option>
                      <option value="+962">+962 (JO)</option>
                      <option value="+963">+963 (SY)</option>
                      <option value="+964">+964 (IQ)</option>
                      <option value="+965">+965 (KW)</option>
                      <option value="+966">+966 (SA)</option>
                      <option value="+967">+967 (YE)</option>
                      <option value="+968">+968 (OM)</option>
                      <option value="+970">+970 (PS)</option>
                      <option value="+971">+971 (AE)</option>
                      <option value="+972">+972 (IL)</option>
                      <option value="+973">+973 (BH)</option>
                      <option value="+974">+974 (QA)</option>
                      <option value="+975">+975 (BT)</option>
                      <option value="+976">+976 (MN)</option>
                      <option value="+977">+977 (NP)</option>
                      <option value="+992">+992 (TJ)</option>
                      <option value="+993">+993 (TM)</option>
                      <option value="+994">+994 (AZ)</option>
                      <option value="+995">+995 (GE)</option>
                      <option value="+996">+996 (KG)</option>
                      <option value="+998">+998 (UZ)</option>
                    </select>
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">
                      ▾
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Enter Your Phone Number"
                    value={formData.phoneNumber}
                    onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                    inputMode="numeric"
                    onBlur={() => handleInputChange("phoneNumber", formData.phoneNumber)}
                    className={`flex-1 px-3 py-2 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.phoneNumber ? "border-red-400 focus:ring-red-500 focus:border-red-500" : "border-slate-300"}`}
                  />
                </div>
                {errors.phoneCountryCode || errors.phoneNumber ? (
                  <p className="mt-1 text-[11px] text-red-600">
                    {errors.phoneCountryCode || errors.phoneNumber}
                  </p>
                ) : null}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Enter Your Addresss"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  onBlur={() => handleInputChange("address", formData.address)}
                  className={`w-full px-3 py-2 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none ${errors.address ? "border-red-400 focus:ring-red-500 focus:border-red-500" : "border-slate-300"}`}
                />
                {errors.address ? (
                  <p className="mt-1 text-[11px] text-red-600">{errors.address}</p>
                ) : null}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  State
                </label>
                <input
                  type="text"
                  placeholder="Enter Your State"
                  value={formData.state}
                  onChange={(e) => handleInputChange("state", e.target.value)}
                  onBlur={() => handleInputChange("state", formData.state)}
                  className={`w-full px-3 py-2 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.state ? "border-red-400 focus:ring-red-500 focus:border-red-500" : "border-slate-300"}`}
                />
                {errors.state ? (
                  <p className="mt-1 text-[11px] text-red-600">{errors.state}</p>
                ) : null}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Pincode
                </label>
                <input
                  type="text"
                  placeholder="Enter Your Pincode"
                  value={formData.pincode}
                  onChange={(e) => handleInputChange("pincode", e.target.value)}
                  inputMode={formData.region === "India" ? "numeric" : "text"}
                  onBlur={() => handleInputChange("pincode", formData.pincode)}
                  className={`w-full px-3 py-2 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.pincode ? "border-red-400 focus:ring-red-500 focus:border-red-500" : "border-slate-300"}`}
                />
                {errors.pincode ? (
                  <p className="mt-1 text-[11px] text-red-600">{errors.pincode}</p>
                ) : null}
              </div>
            </div>

            {/* Logo & favicon upload */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Logo</label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    // Validate file type
                    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
                    if (!allowedTypes.includes(file.type)) {
                      toast.error("Invalid file type. Please upload PNG, JPG, JPEG, or WEBP.");
                      return;
                    }

                    // Validate file size (max 5MB)
                    const maxSize = 5 * 1024 * 1024; // 5MB
                    if (file.size > maxSize) {
                      toast.error("File size exceeds 5MB limit.");
                      return;
                    }

                    setLogoFile(file);
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setLogoPreview(reader.result);
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="hidden"
                />
                <div
                  onClick={() => logoInputRef.current?.click()}
                  className="border border-dashed border-slate-300 rounded-lg bg-slate-50/60 h-28 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors relative overflow-hidden"
                >
                  {logoPreview ? (
                    <>
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLogoPreview(null);
                          setLogoFile(null);
                          if (logoInputRef.current) {
                            logoInputRef.current.value = "";
                          }
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center">
                      <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                      <p className="text-xs text-slate-400">Click to upload logo</p>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Favicon</label>
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/x-icon"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    // Validate file type
                    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/x-icon"];
                    if (!allowedTypes.includes(file.type)) {
                      toast.error("Invalid file type. Please upload PNG, JPG, JPEG, WEBP, or ICO.");
                      return;
                    }

                    // Validate file size (max 5MB)
                    const maxSize = 5 * 1024 * 1024; // 5MB
                    if (file.size > maxSize) {
                      toast.error("File size exceeds 5MB limit.");
                      return;
                    }

                    setFaviconFile(file);
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setFaviconPreview(reader.result);
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="hidden"
                />
                <div
                  onClick={() => faviconInputRef.current?.click()}
                  className="border border-dashed border-slate-300 rounded-lg bg-slate-50/60 h-28 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors relative overflow-hidden"
                >
                  {faviconPreview ? (
                    <>
                      <img
                        src={faviconPreview}
                        alt="Favicon preview"
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFaviconPreview(null);
                          setFaviconFile(null);
                          if (faviconInputRef.current) {
                            faviconInputRef.current.value = "";
                          }
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center">
                      <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                      <p className="text-xs text-slate-400">Click to upload favicon</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Save Button Section */}
          <div className="px-4 py-4 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-[11px] text-slate-500">
                Changes will only be applied after clicking the <span className="font-semibold">Save Information</span> button.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Information"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({ initial = false }) {
  const [enabled, setEnabled] = useState(initial);

  return (
    <button
      type="button"
      onClick={() => setEnabled((prev) => !prev)}
      className={`inline-flex items-center w-10 h-5 rounded-full border transition-all ${enabled ? "bg-blue-600 border-blue-600 justify-end" : "bg-slate-200 border-slate-300 justify-start"
        }`}
    >
      <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
    </button>
  );
}
