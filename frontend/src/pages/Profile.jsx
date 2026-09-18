import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import {
  getProfile, updateSecurity, updatePreferences, updateProfile, changePassword,
  uploadProfilePhoto, Session, initials, toAssetUrl
} from '../api.js';

export default function Profile() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('view'); // 'view' | 'edit' | 'password'
  const [editForm, setEditForm] = useState(null);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    getProfile().then(d => {
      Session.setUser(d.user);
      setData(d);
    }).catch(e => setError(e.message));
  }, []);

  function startEdit() {
    setFormError('');
    setEditForm({
      fullName: data.user.fullName || '',
      dateOfBirth: data.user.dateOfBirth ? data.user.dateOfBirth.slice(0, 10) : '',
      sex: data.user.sex || '',
      civilStatus: data.user.civilStatus || '',
      contactNumber: data.user.contactNumber || '',
      purok: data.user.purok || ''
    });
    setMode('edit');
  }

  async function saveEdit(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const { user } = await updateProfile(editForm);
      Session.setUser(user);
      setData(d => ({ ...d, user }));
      setMode('view');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setFormError('');
    if (pwForm.newPassword !== pwForm.confirmPassword) { setFormError('New passwords do not match.'); return; }
    if (pwForm.newPassword.length < 8) { setFormError('New password must be at least 8 characters.'); return; }
    setSaving(true);
    try {
      await changePassword(pwForm.currentPassword, pwForm.newPassword);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMode('view');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { user } = await uploadProfilePhoto(file);
      Session.setUser(user);
      setData(d => ({ ...d, user }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function toggleTfa() {
    const newVal = !data.user.twoFactorEnabled;
    setData(d => ({ ...d, user: { ...d.user, twoFactorEnabled: newVal } }));
    try { await updateSecurity({ twoFactorEnabled: newVal }); } catch (e) {}
  }
  async function togglePush() {
    const newVal = !data.user.pushNotifications;
    setData(d => ({ ...d, user: { ...d.user, pushNotifications: newVal } }));
    try { await updatePreferences({ pushNotifications: newVal }); } catch (e) {}
  }
  async function toggleEmail() {
    const newVal = !data.user.emailAnnouncements;
    setData(d => ({ ...d, user: { ...d.user, emailAnnouncements: newVal } }));
    try { await updatePreferences({ emailAnnouncements: newVal }); } catch (e) {}
  }
  function logout() {
    Session.clear();
    navigate('/');
  }

  if (error) return (<><Navbar /><div className="page"><div className="error-msg" style={{ marginTop: 20 }}>{error}</div></div></>);
  if (!data) return (<><Navbar /><div className="page"><p style={{ marginTop: 20, color: 'var(--muted)' }}>Loading…</p></div></>);

  const { user, complaintsFiled, complaintsResolved } = data;

  return (
    <>
      <Navbar />
      <div className="page">
        <h1 className="hero-title" style={{ marginTop: 24 }}>Resident Profile</h1>

        <div className="profile-grid">
          <div>
            <label htmlFor="profilePhoto" style={{ cursor: 'pointer', display: 'inline-block', position: 'relative' }}>
              {user.photoUrl ? (
                <img src={toAssetUrl(user.photoUrl)} alt={user.fullName} className="avatar" style={{ objectFit: 'cover' }} />
              ) : (
                <div className="avatar">{initials(user.fullName)}</div>
              )}
              <span style={{
                position: 'absolute', bottom: 0, right: 0, background: 'var(--navy)', color: '#fff',
                borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '.7rem'
              }}>{uploadingPhoto ? '…' : '✎'}</span>
            </label>
            <input id="profilePhoto" type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoSelect} disabled={uploadingPhoto} />
            <div className="profile-name">{user.fullName}</div>
            <p className="profile-desc">
              Barangay Poblacion, Resident ID: {user.residentId}. Actively contributing to community safety and environmental initiatives.
            </p>
            {mode !== 'edit' && (
              <button className="btn btn-navy btn-block" style={{ marginBottom: 20 }} onClick={startEdit}>Edit Profile ✎</button>
            )}

            <div className="stat-card dark">
              <div className="label"><span>🚩</span><span>Complaints Filed</span></div>
              <div className="value">{String(complaintsFiled).padStart(2, '0')}</div>
              <div className="sub">{complaintsFiled ? `${complaintsResolved} successfully resolved` : 'No complaints filed yet'}</div>
            </div>
            <div className="stat-card light">
              <div className="label"><span>♡</span><span>Community Points</span></div>
              <div className="value">{user.communityPoints.toLocaleString()}</div>
              <div className="sub">Tier: {user.tier}</div>
            </div>
          </div>

          <div>
            {mode === 'edit' ? (
              <form className="card" style={{ marginBottom: 20 }} onSubmit={saveEdit}>
                <div className="card-title">🪪 Edit Personal Information</div>
                {formError && <div className="error-msg" style={{ marginBottom: 12 }}>{formError}</div>}
                <div className="field">
                  <label className="field-label">Full Name</label>
                  <input value={editForm.fullName} onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))} required />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label className="field-label">Birthdate</label>
                    <input type="date" value={editForm.dateOfBirth} onChange={e => setEditForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label className="field-label">Sex</label>
                    <select value={editForm.sex} onChange={e => setEditForm(f => ({ ...f, sex: e.target.value }))}>
                      <option value="">Select option</option>
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label className="field-label">Civil Status</label>
                    <select value={editForm.civilStatus} onChange={e => setEditForm(f => ({ ...f, civilStatus: e.target.value }))}>
                      <option value="">Select option</option>
                      <option>Single</option>
                      <option>Married</option>
                      <option>Widowed</option>
                      <option>Separated</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Contact Number</label>
                    <input value={editForm.contactNumber} onChange={e => setEditForm(f => ({ ...f, contactNumber: e.target.value }))} />
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">Purok / Zone</label>
                  <select value={editForm.purok} onChange={e => setEditForm(f => ({ ...f, purok: e.target.value }))}>
                    <option value="">Select location</option>
                    <option>Camulinas Purok Centro</option>
                    <option>Purok Rizal</option>
                    <option>Purok Mabini</option>
                    <option>Purok Bonifacio</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button type="submit" className="btn btn-navy" style={{ flex: 1 }} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
                  <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setMode('view')} disabled={saving}>Cancel</button>
                </div>
              </form>
            ) : (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-title">🪪 Personal Information</div>
                <div className="info-grid"><div className="k">Birthdate</div><div className="v">
                  {user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                </div></div>
                <div className="info-grid"><div className="k">Contact Number</div><div className="v">{user.contactNumber || '—'}</div></div>
                <div className="info-grid"><div className="k">Purok / District</div><div className="v">{user.purok || '—'}</div></div>
                <div className="info-grid"><div className="k">Civil Status</div><div className="v">{user.civilStatus || '—'}</div></div>
              </div>
            )}

            {mode === 'password' ? (
              <form className="card" style={{ marginBottom: 20 }} onSubmit={savePassword}>
                <div className="card-title">🔑 Change Password</div>
                {formError && <div className="error-msg" style={{ marginBottom: 12 }}>{formError}</div>}
                <div className="field">
                  <label className="field-label">Current Password</label>
                  <input type="password" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} required />
                </div>
                <div className="field">
                  <label className="field-label">New Password</label>
                  <input type="password" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} required minLength={8} />
                </div>
                <div className="field">
                  <label className="field-label">Confirm New Password</label>
                  <input type="password" value={pwForm.confirmPassword} onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))} required minLength={8} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button type="submit" className="btn btn-navy" style={{ flex: 1 }} disabled={saving}>{saving ? 'Saving…' : 'Update Password'}</button>
                  <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setMode('view'); setFormError(''); }} disabled={saving}>Cancel</button>
                </div>
              </form>
            ) : (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-title">🛡️ Account Security</div>
                <div className="list-row" style={{ cursor: 'pointer' }} onClick={() => { setFormError(''); setMode('password'); }}>
                  <div className="left"><div className="ic">🔑</div><div><div className="title">Change Password</div><div className="sub">Tap to update your password</div></div></div>
                  <span className="chev">›</span>
                </div>
                <div className="list-row">
                  <div className="left"><div className="ic">🖐️</div><div><div className="title">Two-Factor Auth</div><div className="sub">{user.twoFactorEnabled ? 'Enabled' : 'Disabled'}</div></div></div>
                  <button className={`toggle ${user.twoFactorEnabled ? 'on' : ''}`} onClick={toggleTfa}><div className="knob" /></button>
                </div>
              </div>
            )}

            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">🛡️ Preferences</div>
              <div className="list-row">
                <div className="left"><div className="ic">🔔</div><div className="title">Push Notifications</div></div>
                <button className={`toggle ${user.pushNotifications ? 'on' : ''}`} onClick={togglePush}><div className="knob" /></button>
              </div>
              <div className="list-row">
                <div className="left"><div className="ic">✉️</div><div className="title">Email Announcements</div></div>
                <button className={`toggle ${user.emailAnnouncements ? 'on' : ''}`} onClick={toggleEmail}><div className="knob" /></button>
              </div>
              <div className="list-row">
                <div className="left"><div className="ic">🌐</div><div><div className="title">Language</div><div className="sub">{user.language}</div></div></div>
                <span className="chev">›</span>
              </div>
            </div>

            <button className="btn btn-danger-ghost" onClick={logout}>⇥ Log Out</button>

            <p style={{ fontSize: '.78rem', color: 'var(--muted)', textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
              The Smart Profiling system is built upon strict data privacy protocols. All personal information for Barangay Poblacion residents is encrypted and accessible only by authorized community administrators under the Data Privacy Act of 2012.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
