import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  GraduationCap,
  HeartHandshake,
  Plus,
  ShieldCheck,
  Sprout,
  X,
} from 'lucide-react';
import {
  getAdminClaimStatus,
  type AdminClaimStatus,
} from '../firebase/adminService';
import {
  SCHOOL_GRADES,
  SUPPORTER_ROLES,
  type ParentLoginPayload,
  type SchoolGrade,
  type StudentLoginMetadata,
  type SupporterRole,
} from '../firebase/firebaseClient';

type LoginTab = 'student' | 'parent' | 'admin';

interface FarmerLoginOverlayProps {
  onStudentLogin: (
    farmerName: string,
    passcode: string,
    meta: StudentLoginMetadata
  ) => Promise<void>;
  onParentLogin: (payload: ParentLoginPayload) => Promise<void>;
  onAdminLogin: (adminName: string, passcode: string) => Promise<void>;
  loading: boolean;
  errorMsg: string | null;
  onClearError?: () => void;
}

export const FarmerLoginOverlay: React.FC<FarmerLoginOverlayProps> = ({
  onStudentLogin,
  onParentLogin,
  onAdminLogin,
  loading,
  errorMsg,
  onClearError,
}) => {
  const [activeTab, setActiveTab] = useState<LoginTab>('student');

  // Student fields
  const [farmerName, setFarmerName] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentSchoolName, setStudentSchoolName] = useState('');
  const [studentGrade, setStudentGrade] = useState<SchoolGrade>('Grade 4');
  const [teacherName, setTeacherName] = useState('');

  // Parent / Sponsor / Teacher / Family fields
  const [supporterRole, setSupporterRole] = useState<SupporterRole>('parent');
  const [parentPseudonym, setParentPseudonym] = useState('');
  const [parentPassword, setParentPassword] = useState('');
  const [parentSchoolName, setParentSchoolName] = useState('');
  const [parentGrades, setParentGrades] = useState<SchoolGrade[]>(['Grade 4']);

  // Admin fields
  const [adminName, setAdminName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminStatus, setAdminStatus] = useState<AdminClaimStatus | null>(null);

  useEffect(() => {
    if (activeTab !== 'admin') return;
    let mounted = true;
    void getAdminClaimStatus()
      .then((status) => {
        if (mounted) setAdminStatus(status);
      })
      .catch(() => {
        if (mounted) setAdminStatus(null);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab]);

  const canSubmitStudent =
    farmerName.trim().length > 0 &&
    studentPassword.length > 0 &&
    studentSchoolName.trim().length > 0 &&
    !loading;

  const canSubmitParent =
    parentPseudonym.trim().length > 0 &&
    parentPassword.length > 0 &&
    parentSchoolName.trim().length > 0 &&
    parentGrades.length > 0 &&
    !loading;

  const canSubmitAdmin =
    adminName.trim().length > 0 && adminPassword.length >= 4 && !loading;

  const handleSwitchTab = (tab: LoginTab) => {
    setActiveTab(tab);
    onClearError?.();
  };

  const handleAddParentGrade = () => {
    if (parentGrades.length >= SCHOOL_GRADES.length) return;
    const nextAvailable =
      SCHOOL_GRADES.find((g) => !parentGrades.includes(g)) ?? SCHOOL_GRADES[0];
    setParentGrades((prev) => [...prev, nextAvailable]);
  };

  const handleChangeParentGrade = (index: number, value: SchoolGrade) => {
    setParentGrades((prev) => prev.map((g, i) => (i === index ? value : g)));
  };

  const handleRemoveParentGrade = (index: number) => {
    if (parentGrades.length <= 1) return;
    setParentGrades((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'student') {
      if (!canSubmitStudent) return;
      const trimmedTeacher = teacherName.trim();
      await onStudentLogin(farmerName, studentPassword, {
        schoolName: studentSchoolName,
        grade: studentGrade,
        ...(trimmedTeacher ? { teacherName: trimmedTeacher } : {}),
      });
      return;
    }

    if (activeTab === 'admin') {
      if (!canSubmitAdmin) return;
      await onAdminLogin(adminName, adminPassword);
      return;
    }

    if (!canSubmitParent) return;
    const uniqueGrades = Array.from(new Set(parentGrades));
    await onParentLogin({
      role: supporterRole,
      pseudonym: parentPseudonym,
      passcode: parentPassword,
      schoolName: parentSchoolName,
      grades: uniqueGrades,
    });
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/80 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-slate-950 border border-emerald-500/40 p-6 shadow-2xl my-auto"
      >
        <div className="flex items-center gap-2.5 text-emerald-400">
          <Sprout className="w-5 h-5" />
          <span className="text-xs font-mono font-semibold uppercase tracking-wider">
            Game X Africa · El Niño Lab
          </span>
        </div>

        <h1 className="mt-2 text-xl font-bold text-white">
          {activeTab === 'student'
            ? 'Student Check-In'
            : activeTab === 'admin'
              ? 'Admin Control Check-In'
              : 'Supporter & Parent Check-In'}
        </h1>

        {/* Split Login Three-Tab Toggle */}
        <div
          role="tablist"
          aria-label="Login role selector"
          className="mt-4 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-900 p-1 border border-slate-800"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'student'}
            onClick={() => handleSwitchTab('student')}
            className={`flex items-center justify-center gap-1 rounded-lg py-2 px-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'student'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 shrink-0" />
            <span>Student</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'parent'}
            onClick={() => handleSwitchTab('parent')}
            className={`flex items-center justify-center gap-1 rounded-lg py-2 px-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'parent'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5 shrink-0" />
            <span>Parent</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'admin'}
            onClick={() => handleSwitchTab('admin')}
            className={`flex items-center justify-center gap-1 rounded-lg py-2 px-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Admin</span>
          </button>
        </div>

        {activeTab === 'student' ? (
          <div className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="farmer-name-input"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Farmer Name
              </label>
              <input
                id="farmer-name-input"
                type="text"
                value={farmerName}
                onChange={(e) => setFarmerName(e.target.value)}
                maxLength={40}
                placeholder="e.g. Thabo"
                autoFocus
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label
                htmlFor="farmer-passcode-input"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Password (any letters or numbers)
              </label>
              <input
                id="farmer-passcode-input"
                type="password"
                value={studentPassword}
                onChange={(e) => setStudentPassword(e.target.value)}
                placeholder="Your secret password"
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label
                htmlFor="student-school-input"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                School Name
              </label>
              <input
                id="student-school-input"
                type="text"
                value={studentSchoolName}
                onChange={(e) => setStudentSchoolName(e.target.value)}
                maxLength={100}
                placeholder="Type your school name"
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label
                htmlFor="student-grade-select"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Grade
              </label>
              <select
                id="student-grade-select"
                value={studentGrade}
                onChange={(e) => setStudentGrade(e.target.value as SchoolGrade)}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {SCHOOL_GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="student-teacher-input"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Teacher&apos;s Name <span className="text-slate-400">(Optional)</span>
              </label>
              <input
                id="student-teacher-input"
                type="text"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                maxLength={60}
                placeholder="Optional"
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="supporter-role-select"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Your Role
              </label>
              <select
                id="supporter-role-select"
                value={supporterRole}
                onChange={(e) => setSupporterRole(e.target.value as SupporterRole)}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
              >
                {SUPPORTER_ROLES.map((roleOpt) => (
                  <option key={roleOpt.id} value={roleOpt.id}>
                    {roleOpt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="parent-pseudonym-input"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Supporter / Parent Pseudonym
              </label>
              <input
                id="parent-pseudonym-input"
                type="text"
                value={parentPseudonym}
                onChange={(e) => setParentPseudonym(e.target.value)}
                maxLength={40}
                placeholder="e.g. GreenGuardian"
                autoFocus
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label
                htmlFor="parent-password-input"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Password (any letters or numbers)
              </label>
              <input
                id="parent-password-input"
                type="password"
                value={parentPassword}
                onChange={(e) => setParentPassword(e.target.value)}
                placeholder="Your secret password"
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label
                htmlFor="parent-school-input"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Child&apos;s School Name
              </label>
              <input
                id="parent-school-input"
                type="text"
                value={parentSchoolName}
                onChange={(e) => setParentSchoolName(e.target.value)}
                maxLength={100}
                placeholder="Type your child's school name"
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label
                htmlFor="parent-grade-select-0"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Child&apos;s Grade
              </label>
              <div className="space-y-2">
                {parentGrades.map((gradeValue, index) => (
                  <div key={`parent-grade-row-${index}`} className="flex items-center gap-2">
                    <select
                      id={`parent-grade-select-${index}`}
                      value={gradeValue}
                      onChange={(e) =>
                        handleChangeParentGrade(index, e.target.value as SchoolGrade)
                      }
                      className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                    >
                      {SCHOOL_GRADES.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </select>
                    {parentGrades.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveParentGrade(index)}
                        aria-label={`Remove grade ${gradeValue}`}
                        className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-slate-400 hover:border-rose-500/50 hover:text-rose-300 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {parentGrades.length < SCHOOL_GRADES.length && (
                <button
                  type="button"
                  onClick={handleAddParentGrade}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add another grade</span>
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-sky-950/40 border border-sky-500/35 p-3 text-xs text-sky-200 leading-relaxed">
              {adminStatus?.claimed
                ? `Primary Admin (${adminStatus.primaryAdminName ?? 'Claimed'}) is registered. Enter your Admin Name and passcode to unlock Competition Timer, Challenge Rules, and Document Uploads.`
                : 'First-Run Admin Setup: No primary admin has been claimed yet. Choose your Admin Name and passcode (4+ chars) to register as the Admin.'}
            </div>

            <div>
              <label
                htmlFor="admin-name-input"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Admin Name
              </label>
              <input
                id="admin-name-input"
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                maxLength={40}
                placeholder="e.g. Coordinator"
                autoFocus
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label
                htmlFor="admin-passcode-input"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Admin Passcode (min 4 characters)
              </label>
              <input
                id="admin-passcode-input"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter admin passcode"
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        )}

        {errorMsg && (
          <p className="mt-3 text-xs text-rose-400 font-medium">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={
            activeTab === 'student'
              ? !canSubmitStudent
              : activeTab === 'admin'
                ? !canSubmitAdmin
                : !canSubmitParent
          }
          className={`mt-5 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors ${
            activeTab === 'student'
              ? canSubmitStudent
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : activeTab === 'admin'
                ? canSubmitAdmin
                  ? 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : canSubmitParent
                  ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <span>
            {loading
              ? activeTab === 'student'
                ? 'Loading Farm...'
                : activeTab === 'admin'
                  ? 'Verifying Admin...'
                  : 'Opening Portal...'
              : activeTab === 'student'
                ? 'Enter Workshop'
                : activeTab === 'admin'
                  ? adminStatus?.claimed
                    ? 'Sign In as Admin'
                    : 'Claim Admin & Enter'
                  : 'Enter Parent Portal'}
          </span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
