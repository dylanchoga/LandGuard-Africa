import React, { useEffect, useMemo, useState } from 'react'
import BlockchainVerification from "./BlockchainVerification";

import BinanceWalletConnect from "./BinanceWalletConnect";

import ApplicationIntegrityCheck from "./ApplicationIntegrityCheck";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, BookOpen, CalendarDays,
  CheckCircle2, ChevronRight, ClipboardList, Clock3, Eye, FileCheck2,
  FileText, House, Info, Landmark, LockKeyhole, LogOut, Menu, Plus, Search,
  ShieldCheck, Sparkles, UsersRound, MessageCircle, Send, X
} from 'lucide-react'

const provinces = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'
]
const statusNames = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  NEEDS_DOCUMENTS: 'Documents requested',
  REVIEW_COMPLETE: 'Review complete'
}
const transitions = {
  SUBMITTED: ['UNDER_REVIEW', 'NEEDS_DOCUMENTS'],
  UNDER_REVIEW: ['NEEDS_DOCUMENTS', 'REVIEW_COMPLETE'],
  NEEDS_DOCUMENTS: ['UNDER_REVIEW'],
  REVIEW_COMPLETE: []
}
const startingChat = [{ from: 'assistant', text: 'Hello! I can help you understand housing options, document requirements and the progress recorded in your LandGuard account. What would you like to know?', sources: [] }]
const eligibilityInitial = { monthly_income: '', age: '', citizenship: 'unsure', previously_received_subsidy: 'unsure', previously_owned_property: 'unsure', has_partner_or_dependants: 'unsure' }
const initialForm = {
  full_name: '', monthly_income: '', household_members: '', province: 'Gauteng', notes: ''
}

// The role selector changes only the sign-in presentation. The server still
// authenticates credentials and enforces all role permissions.
const portalRoles = [
  { id: 'applicant', label: 'Applicant', username: 'thandi', icon: UsersRound },
  { id: 'admin', label: 'Housing officer', username: 'housing', icon: Landmark },
  { id: 'auditor', label: 'Auditor', username: 'oversight', icon: ShieldCheck }
]
const loginAliases = {
  thandi: 'thandi@landguard.local',
  housing: 'housing@landguard.local',
  admin: 'housing@landguard.local',
  oversight: 'oversight@landguard.local',
  auditor: 'oversight@landguard.local'
}

async function api(path, { token, method = 'GET', body } = {}) {
  const response = await fetch('/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Something went wrong. Please try again.')
  return data
}
const dateLabel = value => value ? new Date(value).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const dateTimeLabel = value => value ? new Date(value).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const moneyLabel = value => Number(value || 0).toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })
const roleName = role => ({ applicant: 'Applicant', admin: 'Housing officer', auditor: 'Oversight officer' }[role] || 'Member')
const actionName = action => ({ APPLICATION_CREATED: 'Application created', STATUS_CHANGED: 'Application status updated' }[action] || (action || 'Activity').replaceAll('_', ' '))

function Mark({ className = '' }) {
  return <div className={'brandMark ' + className} aria-hidden="true"><House size={22} strokeWidth={2.2}/><span className="markDot"/></div>
}
function Badge({ status }) {
  return <span className={'statusBadge ' + (status || '').toLowerCase()}><span className="badgeDot"/>{statusNames[status] || status || 'Unknown'}</span>
}
function IconLabel({ icon: Icon, children }) {
  return <span className="iconLabel"><Icon size={16}/>{children}</span>
}
function EmptyState({ icon: Icon = ClipboardList, title, description, action }) {
  return <div className="emptyState"><div className="emptyIcon"><Icon size={26}/></div><h3>{title}</h3><p>{description}</p>{action}</div>
}

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('landguard_token') || '')
  const [user, setUser] = useState(null)
  const [loginEmail, setLoginEmail] = useState('')
  const [selectedRole, setSelectedRole] = useState('applicant')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState(null)
  const [page, setPage] = useState('overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [records, setRecords] = useState([])
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])
  const [form, setForm] = useState(initialForm)
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [nextStatus, setNextStatus] = useState('')
  const [reason, setReason] = useState('')
  const [chatMessages, setChatMessages] = useState(startingChat)
  const [chatText, setChatText] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [eligibility, setEligibility] = useState(eligibilityInitial)
  const [eligibilityResult, setEligibilityResult] = useState(null)
  const [eligibilityBusy, setEligibilityBusy] = useState(false)

  function notify(message, kind = 'success') { setNotice({ kind, message }) }
  function logout() {
    sessionStorage.removeItem('landguard_token')
    setToken(''); setUser(null); setRecords([]); setSelected(null); setHistory([])
    setPage('overview'); setNotice(null); setChatMessages(startingChat); setChatText('')
  }
  async function reload(activeToken = token) {
    const rows = await api('/applications', { token: activeToken })
    setRecords(rows)
    return rows
  }
  useEffect(() => {
    if (!token) return
    let cancelled = false
    Promise.all([api('/auth/me', { token }), api('/applications', { token })])
      .then(([account, rows]) => { if (!cancelled) { setUser(account); setRecords(rows) } })
      .catch(() => { if (!cancelled) logout() })
    return () => { cancelled = true }
  }, [token])

  async function login(event) {
    event.preventDefault(); setLoading(true); setNotice(null)
    try {
      const nameOrEmail = loginEmail.trim().toLowerCase()
      const email = loginAliases[nameOrEmail] || nameOrEmail
      const data = await api('/auth/login', { method: 'POST', body: { email, password } })
      sessionStorage.setItem('landguard_token', data.access_token)
        setToken(data.access_token); setUser(data.user); setPassword(''); setPage('overview')
    } catch (err) { notify(err.message, 'error') }
    finally { setLoading(false) }
  }
  async function createApplication(event) {
    event.preventDefault(); setLoading(true); setNotice(null)
    try {
      await api('/applications', {
        token, method: 'POST',
        body: { ...form, monthly_income: Number(form.monthly_income), household_members: Number(form.household_members) }
      })
      await reload(); setForm(initialForm); setPage('applications')
      notify('Your application record has been saved successfully.')
    } catch (err) { notify(err.message, 'error') }
    finally { setLoading(false) }
  }

  async function openApplication(record) {
    setPage('detail')
    setSelected(record)
    setHistory([])
    setNotice(null)

    const available = transitions[record.status] || []
    setNextStatus(available[0] || '')
    setReason('')

    try {
      // Fetch the full application, including blockchain proof
      const details = await api('/applications/' + record.id, {
        token
      })

      setSelected(details)

      // Fetch application activity history
      const events = await api(
        '/applications/' + record.id + '/history',
        { token }
      )

      setHistory(events)

    } catch (err) {
      notify(err.message, 'error')
    }
  }

  
  async function changeStatus(event) {
    event.preventDefault(); setLoading(true); setNotice(null)
    try {
      const updated = await api('/applications/' + selected.id + '/status', {
        token, method: 'PATCH', body: { status: nextStatus, reason }
      })
      const rows = await reload()
      const latest = rows.find(item => item.id === updated.id) || updated
      await openApplication(latest)
      notify('Application status updated and recorded in the activity history.')
    } catch (err) { notify(err.message, 'error') }
    finally { setLoading(false) }
  }
  async function sendAssistantMessage(event, preset) {
    if (event?.preventDefault) event.preventDefault()
    const text = (preset ?? chatText).trim()
    if (!text || chatBusy) return
    // Include the latest exchanges so the actual model can follow a conversation.
    // The welcome greeting and error messages are not sent as history.
    const history = chatMessages.slice(1).filter(item => !item.error).slice(-10)
      .map(item => ({ role: item.from === 'user' ? 'user' : 'assistant', text: item.text }))
    setChatMessages(previous => [...previous, { from: 'user', text }])
    setChatText(''); setChatBusy(true)
    try {
      const result = await api('/assistant/chat', { token, method: 'POST', body: { message: text, history } })
      setChatMessages(previous => [...previous, { from: 'assistant', text: result.answer, sources: result.sources || [], model: result.model }])
    } catch (error) {
      setChatMessages(previous => [...previous, { from: 'assistant', text: error.message || 'Unable to respond right now. Please try again.', sources: [], error: true }])
    } finally { setChatBusy(false) }
  }
  async function checkEligibility(event) {
    event.preventDefault()
    setEligibilityBusy(true); setEligibilityResult(null)
    try {
      const result = await api('/assistant/eligibility', { token, method: 'POST', body: {
        ...eligibility,
        monthly_income: Number(eligibility.monthly_income),
        age: eligibility.age === '' ? null : Number(eligibility.age)
      }})
      setEligibilityResult(result)
    } catch (error) { notify(error.message, 'error') }
    finally { setEligibilityBusy(false) }
  }
  function go(destination) {
    setPage(destination); setMenuOpen(false); setNotice(null)
  }
  const displayed = useMemo(() => records.filter(row => {
    const fitsStatus = filter === 'ALL' || row.status === filter
    const query = search.toLowerCase().trim()
    const fitsSearch = !query || [row.id, row.full_name, row.province].some(value => String(value || '').toLowerCase().includes(query))
    return fitsStatus && fitsSearch
  }), [records, filter, search])
  const inReview = records.filter(item => item.status === 'UNDER_REVIEW').length
  const needsAttention = records.filter(item => item.status === 'NEEDS_DOCUMENTS').length
  const greeting = user?.display_name?.trim().split(' ')[0] || 'there'
  const officer = user?.role === 'admin'
  const applicant = user?.role === 'applicant'
  const auditor = user?.role === 'auditor'
 const menus = [
  { page: 'overview', title: 'Overview', icon: House },
  { page: 'applications', title: applicant ? 'My applications' : 'Applications', icon: ClipboardList },

  ...(applicant
    ? [
        { page: 'new', title: 'New application', icon: Plus },
        { page: 'assistant', title: 'Housing assistant', icon: MessageCircle }
      ]
    : []),

  ...(officer || auditor
    ? [
        {
          page: 'blockchain',
          title: 'Blockchain verification',
          icon: ShieldCheck
        }
      ]
    : []),

  { page: 'guide', title: 'Housing guide', icon: BookOpen }
];

  return <div className="appShell">
    {!user ? <div className="authLayout">
      <section className="authHero">
        <div className="heroOrb orbOne"/><div className="heroOrb orbTwo"/>
        <div className="heroBrand"><Mark/><div><strong>LandGuard<span>Africa</span></strong><small>Fair Housing. Verified Records. Accountable Decisions.</small></div></div>
        <div className="heroCopy">
          <div className="eyebrow light"><span className="sparkleLine"/><span>HOUSING ACCESS, REIMAGINED</span></div>
          <h1>A fairer way <br/>forward <span>starts here.</span></h1>
          <p>One clear place to organise your housing application, follow updates and understand each step along the way.</p>
          <div className="heroBenefits">
            <div><span className="benefitIcon"><FileCheck2 size={20}/></span><span><strong>Clear application records</strong><small>Your information, organised in one place</small></span></div>
            <div><span className="benefitIcon"><Clock3 size={20}/></span><span><strong>Progress you can follow</strong><small>See recorded updates as they happen</small></span></div>
            <div><span className="benefitIcon"><ShieldCheck size={20}/></span><span><strong>Accountable processes</strong><small>A history of important review actions</small></span></div>
          </div>
        </div>
        <div className="heroVisual" aria-hidden="true">
          <div className="miniBuilding miniBuildingOne"/><div className="miniBuilding miniBuildingTwo"/>
          <div className="visualCard"><span className="visualIcon"><House size={21}/></span><span><small>Housing matters</small><strong>Every step deserves clarity.</strong></span><CheckCircle2 size={22}/></div>
        </div>
        <div className="heroBottom"><span>BUILT FOR CLARITY</span><span>DESIGNED FOR ACCOUNTABILITY</span></div>
      </section>
      <section className="authPanel">
        <div className="authMobileBrand"><Mark/><strong>LandGuard Africa</strong></div>
        <div className="authCard">
          <span className="portalTag"><span className="onlineDot"/> SECURE PORTAL</span>
          <h2>Welcome back<span className="period">.</span></h2>
          <p className="authSubtitle">Choose your workspace and sign in securely.</p>
          <div className="portalRoleSelector" role="group" aria-label="Choose a workspace">
            {portalRoles.map(({ id, label, username, icon: Icon }) =>
              <button key={id} type="button" className={'portalRoleOption ' + (selectedRole === id ? 'active' : '')}
                aria-pressed={selectedRole === id} onClick={() => { setSelectedRole(id); setLoginEmail(username); setPassword(''); setNotice(null) }}>
                <Icon size={19} strokeWidth={1.9}/><span>{label}</span>
              </button>
            )}
          </div>
          <form onSubmit={login} className="authForm">
            <label htmlFor="login-email">Username or email</label>
            <div className="inputIconWrap"><span className="fieldIcon"><UsersRound size={17}/></span><input id="login-email" type="text" required autoComplete="username" placeholder="Enter your username" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}/></div>
            <label htmlFor="login-password">Password</label>
            <div className="inputIconWrap"><span className="fieldIcon"><LockKeyhole size={17}/></span><input id="login-password" type="password" required autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)}/></div>
            {notice?.kind === 'error' && <div className="toast error"><Info size={16}/>{notice.message}</div>}
            <button className="button primary full" disabled={loading} type="submit">{loading ? 'Signing in…' : 'Sign in'} <ArrowRight size={18}/></button>
          </form>
          <div className="authHelp"><ShieldCheck size={16}/><span>Your workspace is accessible only with authorised credentials.</span></div>
        </div>
        <div className="authPanelFooter">© {new Date().getFullYear()} LandGuard Africa <span>·</span> Independent housing support platform</div>
      </section>
    </div> : <div className="mainLayout">
      <aside className={'sideNav ' + (menuOpen ? 'isOpen' : '')}>
        <div className="sideBrand"><Mark/><div><strong>LandGuard<span>Africa</span></strong><small>HOUSING PLATFORM</small></div></div>
        <div className="sideLabel">YOUR WORKSPACE</div>
        <nav className="navItems" aria-label="Primary navigation">{menus.map(({ page: target, title, icon: Icon }) => <button key={target} className={'navItem ' + (page === target || (page === 'detail' && target === 'applications') ? 'active' : '')} onClick={() => go(target)}><Icon size={19}/><span>{title}</span>{page === target && <span className="navActiveBar"/>}</button>)}</nav>
        <div className="sideSpacer"/>
        <div className="sideSupport"><div className="supportTop"><ShieldCheck size={20}/><span>Thoughtfully protected</span></div><p>Access to applications and review actions is based on your account permissions.</p></div>
        <div className="sideProfile"><div className="profileAvatar">{user.display_name?.charAt(0)?.toUpperCase() || 'L'}</div><div className="profileText"><strong>{user.display_name}</strong><small>{roleName(user.role)}</small></div><button title="Sign out" aria-label="Sign out" onClick={logout}><LogOut size={18}/></button></div>
      </aside>
      {menuOpen && <button className="menuBackdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)}/>}
      <div className="mainColumn">
        <header className="appHeader"><div className="appHeaderStart"><button className="mobileMenu" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu size={22}/></button><span className="breadcrumbBrand">LANDGUARD</span><ChevronRight size={14}/><span className="breadcrumbCurrent">{({ overview: 'Overview', applications: 'Applications', new: 'New application', detail: 'Application details', guide: 'Housing guide', assistant: 'Housing assistant', blockchain: 'Blockchain verification' })[page]}</span></div><div className="appHeaderEnd"><span className="headerRole"><ShieldCheck size={15}/>{roleName(user.role)}</span><div className="smallAvatar">{user.display_name?.charAt(0)?.toUpperCase() || 'L'}</div></div></header>
        <main className="pageContent">
          {notice && <div role={notice.kind === 'error' ? 'alert' : 'status'} className={'toast ' + notice.kind}><span>{notice.kind === 'error' ? <Info size={18}/> : <CheckCircle2 size={18}/>}</span>{notice.message}<button onClick={() => setNotice(null)} aria-label="Dismiss notification"><X size={16}/></button></div>}
       
{page === 'blockchain' && (officer || auditor) && (
  <>
    <BlockchainVerification />
    {auditor && <BinanceWalletConnect />}
  </>
)}


          {page === 'overview' && <>
            <div className="pageTitle"><div><div className="eyebrow">YOUR LANDGUARD WORKSPACE</div><h1>Hello, {greeting}<span className="period">.</span></h1><p>Here's an overview of your housing applications and recent activity.</p></div><div className="todayPill"><CalendarDays size={17}/>{dateLabel(new Date())}</div></div>
            <div className="welcomeBanner"><div className="welcomeText"><span className="bannerKicker"><Sparkles size={16}/> MADE FOR A CLEARER JOURNEY</span><h2>Know where you stand.<br/><span>Move forward with confidence.</span></h2><p>Manage your housing records, follow every update and keep important information together.</p><button className="button light" onClick={() => go(applicant ? 'new' : 'applications')}>{applicant ? 'Create an application' : 'View applications'}<ArrowRight size={17}/></button></div><div className="bannerArt" aria-hidden="true"><div className="artHouse houseBack"/><div className="artHouse houseFront"/><div className="artBadge"><ShieldCheck size={24}/></div></div></div>
            <div className="summaryCards"><div className="summaryCard"><div className="summaryTop"><span>Applications</span><div className="summaryIcon forest"><ClipboardList size={20}/></div></div><strong>{records.length.toString().padStart(2, '0')}</strong><small>Available in your workspace</small></div><div className="summaryCard"><div className="summaryTop"><span>Under review</span><div className="summaryIcon blue"><Clock3 size={20}/></div></div><strong>{inReview.toString().padStart(2, '0')}</strong><small>Currently being assessed</small></div><div className="summaryCard"><div className="summaryTop"><span>Action required</span><div className="summaryIcon amber"><FileText size={20}/></div></div><strong>{needsAttention.toString().padStart(2, '0')}</strong><small>Applications requesting documents</small></div></div>
            <div className="contentGrid"><section className="surfacePanel"><div className="panelHead"><div><h3>Recent applications</h3><p>Keep track of your latest records</p></div><button className="subtleLink" onClick={() => go('applications')}>View all <ArrowUpRight size={16}/></button></div>{records.length ? <div className="recentList">{records.slice(0, 4).map(record => <button className="recentRow" onClick={() => openApplication(record)} key={record.id}><span className="recordIcon"><FileText size={18}/></span><span className="recentMain"><strong>{record.full_name || 'Application ' + record.id.slice(0, 8).toUpperCase()}</strong><small>Ref. {record.id.slice(0, 8).toUpperCase()} · {dateLabel(record.created_at)}</small></span><Badge status={record.status}/><ChevronRight className="recentChevron" size={17}/></button>)}</div> : <EmptyState title="No applications yet" description="Applications you create or can review will appear here." action={applicant ? <button className="button secondary" onClick={() => go('new')}>Create application <Plus size={16}/></button> : null}/>}</section><section className="surfacePanel helpPanel"><div className="panelHead"><div><h3>Housing information</h3><p>Useful guidance, all in one place</p></div><BookOpen size={21}/></div><div className="helpIllustration"><House size={42} strokeWidth={1.4}/><span className="helpCircle circleOne"/><span className="helpCircle circleTwo"/></div><h4>Have questions about the process?</h4><p>Explore important application steps, common terms and the information you may need.</p><button className="button secondary full" onClick={() => go('guide')}>Explore housing guide <ArrowRight size={17}/></button></section></div>
          </>}

          {page === 'applications' && <>
            <div className="pageTitle"><div><div className="eyebrow">APPLICATION MANAGEMENT</div><h1>{applicant ? 'My applications' : 'Applications'}<span className="period">.</span></h1><p>{auditor ? 'Review application activity and recorded decisions.' : 'View applications, track statuses and open individual records.'}</p></div>{applicant && <button className="button primary" onClick={() => go('new')}><Plus size={17}/> New application</button>}</div>
            <section className="surfacePanel applicationsPanel"><div className="listToolbar"><div className="searchBox"><Search size={18}/><input aria-label="Search applications" placeholder="Search name, reference or province" value={search} onChange={e => setSearch(e.target.value)}/></div><select aria-label="Filter applications by status" className="filterSelect" value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">All statuses</option>{Object.entries(statusNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><div className="listHead"><span>APPLICATION</span><span>DATE CREATED</span><span>STATUS</span><span/></div>{displayed.length ? displayed.map(record => <button className="applicationRow" key={record.id} onClick={() => openApplication(record)}><span className="rowPerson"><span className="rowPersonIcon"><FileText size={19}/></span><span><strong>{record.full_name || 'Application record'}</strong><small>#{record.id.slice(0, 8).toUpperCase()}{record.province ? ' · ' + record.province : ''}</small></span></span><span className="rowDate">{dateLabel(record.created_at)}</span><Badge status={record.status}/><ChevronRight size={19} className="rowArrow"/></button>) : <EmptyState icon={Search} title={records.length ? 'No matching applications' : 'No applications found'} description={records.length ? 'Try another search term or choose a different status.' : 'Applications available to your account will be displayed here.'} action={applicant && !records.length ? <button className="button primary" onClick={() => go('new')}>Create an application <Plus size={17}/></button> : null}/>}<div className="listFooter">Showing {displayed.length} of {records.length} applications</div></section>
          </>}

          {page === 'new' && applicant && <>
            <div className="pageTitle"><div><div className="eyebrow">HOUSING APPLICATION</div><h1>New application<span className="period">.</span></h1><p>Enter your application details to create a record in your LandGuard workspace.</p></div></div>
            <div className="formLayout"><section className="surfacePanel formPanel"><div className="formPanelTitle"><div className="sectionSymbol"><UsersRound size={22}/></div><div><h3>Applicant details</h3><p>Tell us about your household and housing needs.</p></div></div><form onSubmit={createApplication}><div className="fieldGrid"><label className="field">Full name<input type="text" minLength="2" maxLength="100" autoComplete="name" required placeholder="Enter your full name" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}/></label><label className="field">Province<select value={form.province} onChange={e => setForm({ ...form, province: e.target.value })}>{provinces.map(name => <option key={name} value={name}>{name}</option>)}</select></label><label className="field">Monthly household income (ZAR)<input type="number" min="0" max="10000000" required placeholder="e.g. 2800" value={form.monthly_income} onChange={e => setForm({ ...form, monthly_income: e.target.value })}/></label><label className="field">Number of household members<input type="number" min="1" max="50" required placeholder="e.g. 3" value={form.household_members} onChange={e => setForm({ ...form, household_members: e.target.value })}/></label></div><label className="field">Additional information <span className="optional">(optional)</span><textarea maxLength="1500" rows="4" placeholder="Add any relevant information about your housing needs" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}/></label><div className="formActions"><button type="button" className="button tertiary" onClick={() => go('overview')}>Cancel</button><button type="submit" disabled={loading} className="button primary">{loading ? 'Saving…' : 'Save application'} <ArrowRight size={17}/></button></div></form></section><aside className="sideInfoCard"><span className="sideInfoIcon"><ShieldCheck size={25}/></span><h3>Your information matters.</h3><p>Keep your application details accurate and up to date. Avoid entering ID numbers, banking details or sensitive documents in the notes field.</p><div className="sideInfoDivider"/><IconLabel icon={CheckCircle2}>Organised application records</IconLabel><IconLabel icon={Clock3}>Clear progress updates</IconLabel><IconLabel icon={FileCheck2}>Recorded review history</IconLabel></aside></div>
          </>}

          {page === 'detail' && selected && <>
            <button className="backLink" onClick={() => go('applications')}><ArrowLeft size={17}/> Back to applications</button><div className="detailHeading"><div><div className="eyebrow">APPLICATION #{selected.id.slice(0, 8).toUpperCase()}</div><h1>Application details<span className="period">.</span></h1><p>Created {dateLabel(selected.created_at)} · Last updated {dateLabel(selected.updated_at)}</p></div><Badge status={selected.status}/></div>
            {(officer || auditor) && (
             <ApplicationIntegrityCheck
                key={selected.id}
                applicationId={selected.id}
               token={token}
                api={api}
             />
              )}

            <div className="detailLayout"><section className="surfacePanel detailsPanel"><div className="panelHead"><div><h3>Application overview</h3><p>Current information on file</p></div><FileText size={20}/></div><div className="detailInfo"><div><span>Reference number</span><strong className="refText">{selected.id}</strong></div><div><span>Current status</span><Badge status={selected.status}/></div><div><span>Date created</span><strong>{dateTimeLabel(selected.created_at)}</strong></div>{selected.full_name && <><div><span>Applicant</span><strong>{selected.full_name}</strong></div><div><span>Province</span><strong>{selected.province}</strong></div><div><span>Monthly household income</span><strong>{moneyLabel(selected.monthly_income)}</strong></div><div><span>Household members</span><strong>{selected.household_members}</strong></div></>}{selected.notes && <div className="detailNote"><span>Additional information</span><strong>{selected.notes}</strong></div>}</div></section><section className="surfacePanel activityPanel"><div className="panelHead"><div><h3>Activity history</h3><p>A record of changes and important actions</p></div><Clock3 size={20}/></div>{history.length ? <div className="activityList">{history.map((event, index) => <div className="activityItem" key={index}><span className="activityDot"/><div><strong>{actionName(event.action)}</strong><small>{dateTimeLabel(event.created_at)}</small>{event.details?.after && <span className="activityInfo">New status: {statusNames[event.details.after] || event.details.after}</span>}{event.details?.reason && <p>{event.details.reason}</p>}</div></div>)}</div> : <div className="emptySmall">No activity recorded yet.</div>}</section></div>
            
            
<section className="surfacePanel reviewPanel">
  <div className="panelHead">
    <div>
      <h3>Blockchain verification</h3>
      <p>Independent proof of application registration</p>
    </div>
    <ShieldCheck size={22} />
  </div>

  <div className="detailInfo">
    <div>
      <span>Blockchain network</span>
      <strong>
        {selected.blockchain?.network || "Avalanche Fuji"}
      </strong>
    </div>

    <div>
      <span>Verification status</span>
      <strong>
        {selected.blockchain?.status === "CONFIRMED"
          ? "Confirmed on blockchain"
          : selected.blockchain?.status === "PENDING"
          ? "Awaiting blockchain registration"
          : selected.blockchain?.status === "NEEDS_REVIEW"
          ? "Verification requires review"
          : selected.blockchain?.status === "PROCESSING"
          ? "Registration processing"
          : "Verification unavailable"}
      </strong>
    </div>

    {selected.blockchain?.transaction_hash && (
      <div>
        <span>Transaction hash</span>
        <strong className="refText" style={{overflowWrap: "anywhere"}}>
          {selected.blockchain.transaction_hash}
        </strong>
      </div>
    )}
  </div>

  {selected.blockchain?.status === "CONFIRMED" &&
    selected.blockchain?.explorer_url && (
      <div style={{padding: "20px 24px"}}>
        <a
          className="button primary"
          href={selected.blockchain.explorer_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Verify on Public Blockchain
          <ArrowUpRight size={17} />
        </a>
        <p style={{marginTop: 12, fontSize: 13}}>
          View the transaction independently on Avalanche
          Fuji. This confirms the registration proof was
          recorded, not that housing eligibility or
          allocation was approved.
        </p>
      </div>
    )}
</section>


            {officer && (transitions[selected.status] || []).length > 0 && <section className="surfacePanel reviewPanel"><div className="formPanelTitle"><div className="sectionSymbol"><FileCheck2 size={21}/></div><div><h3>Record a review action</h3><p>Update the application stage and provide a reason for your decision.</p></div></div><form onSubmit={changeStatus}><div className="reviewGrid"><label className="field">Update status<select required value={nextStatus} onChange={e => setNextStatus(e.target.value)}>{transitions[selected.status].map(key => <option value={key} key={key}>{statusNames[key]}</option>)}</select></label><label className="field">Reason for update<textarea required minLength="5" maxLength="500" rows="3" placeholder="Describe why the status is changing" value={reason} onChange={e => setReason(e.target.value)}/></label></div><button className="button primary" type="submit" disabled={loading}>{loading ? 'Saving…' : 'Record status update'}<ArrowRight size={17}/></button></form></section>}
          </>}

          {page === 'assistant' && applicant && <>
            <div className="pageTitle"><div><div className="eyebrow">PERSONALISED HOUSING GUIDANCE</div><h1>Ask LandGuard<span className="period">.</span></h1><p>Understand your housing options, get document guidance and follow your application progress.</p></div></div>
            <div className="assistantGrid">
              <section className="surfacePanel aiChatPanel">
                <div className="aiPanelHead"><span className="aiBotIcon"><Sparkles size={22}/></span><div><h3>Housing assistant</h3><p>Ask naturally, including follow-up questions</p></div></div>
                <div className="aiChatFeed" aria-live="polite">
                  {chatMessages.map((entry, i) => <div key={i} className={'aiMessage ' + entry.from + (entry.error ? ' hasError' : '')}>
                    {entry.from === 'assistant' && <span className="aiMessageIcon"><Sparkles size={16}/></span>}
                    <div className="aiBubble"><div className="aiMessageText">{entry.text}</div>{entry.model && <div className="aiModelLabel">Powered by {entry.model}</div>}{entry.sources?.length > 0 && <div className="aiSources"><span>Official reference material:</span>{entry.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title} <ArrowUpRight size={12}/></a>)}</div>}</div>
                  </div>)}
                  {chatBusy && <div className="aiMessage assistant"><span className="aiMessageIcon"><Sparkles size={16}/></span><div className="aiBubble"><span className="aiTyping">Thinking through your question…</span></div></div>}
                </div>
                <div className="aiSuggestions">{['Can I qualify for a housing subsidy?', 'What documents will I need?', 'Track my application'].map(prompt => <button key={prompt} type="button" disabled={chatBusy} onClick={() => sendAssistantMessage(null, prompt)}>{prompt}</button>)}</div>
                <form className="aiChatForm" onSubmit={sendAssistantMessage}><input type="text" aria-label="Ask a housing question" placeholder="Type a question about housing…" minLength="2" maxLength="1200" value={chatText} onChange={event => setChatText(event.target.value)}/><button className="button primary" aria-label="Send message" disabled={chatBusy || chatText.trim().length < 2} type="submit"><Send size={18}/></button></form>
                <p className="aiPrivacyNote"><LockKeyhole size={14}/> Please don't include identity numbers, bank details or confidential documents in chat.</p>
              </section>
              <section className="surfacePanel aiEligibilityPanel">
                <div className="aiPanelHead"><span className="aiBotIcon eligibilityIcon"><FileCheck2 size={22}/></span><div><h3>Check eligibility</h3><p>Review published programme criteria</p></div></div>
                <form className="aiEligibilityForm" onSubmit={checkEligibility}>
                  <label className="field">Monthly household income (R)<input type="number" min="0" max="10000000" required value={eligibility.monthly_income} placeholder="e.g. 2800" onChange={event => setEligibility({...eligibility, monthly_income: event.target.value})}/></label>
                  <label className="field">Age <span className="optional">(optional)</span><input type="number" min="0" max="120" placeholder="Your age" value={eligibility.age} onChange={event => setEligibility({...eligibility, age: event.target.value})}/></label>
                  <label className="field">Residency<select value={eligibility.citizenship} onChange={event => setEligibility({...eligibility, citizenship: event.target.value})}><option value="unsure">Choose an option</option><option value="citizen">South African citizen</option><option value="permanent_resident">Permanent resident</option><option value="other">Other</option></select></label>
                  <label className="field">Have you received a housing subsidy before?<select value={eligibility.previously_received_subsidy} onChange={event => setEligibility({...eligibility, previously_received_subsidy: event.target.value})}><option value="unsure">Not sure</option><option value="no">No</option><option value="yes">Yes</option></select></label>
                  <label className="field">Have you previously owned a property?<select value={eligibility.previously_owned_property} onChange={event => setEligibility({...eligibility, previously_owned_property: event.target.value})}><option value="unsure">Not sure</option><option value="no">No</option><option value="yes">Yes</option></select></label>
                  <label className="field">Married, living with a partner, or have dependants?<select value={eligibility.has_partner_or_dependants} onChange={event => setEligibility({...eligibility, has_partner_or_dependants: event.target.value})}><option value="unsure">Not sure</option><option value="no">No</option><option value="yes">Yes</option></select></label>
                  <button className="button primary full" type="submit" disabled={eligibilityBusy}>{eligibilityBusy ? 'Checking…' : 'Check requirements'} <ArrowRight size={17}/></button>
                </form>
                {eligibilityResult && <div className="aiAssessment" aria-live="polite"><div className="assessmentHeader"><BadgeCheck size={19}/><span>Assessment summary</span></div><h4>{eligibilityResult.programme}</h4><p>{eligibilityResult.summary}</p><div className="assessmentChecks">{eligibilityResult.checks.map((check, i) => <div key={i}><strong>{check.item}</strong><span>{check.result}</span><small>{check.detail}</small></div>)}</div><h5>Next steps</h5><ul>{eligibilityResult.next_steps.map((step, i) => <li key={i}>{step}</li>)}</ul><div className="assessmentSource">{eligibilityResult.sources.map(source => <a href={source.url} key={source.url} target="_blank" rel="noopener noreferrer">{source.title} <ArrowUpRight size={12}/></a>)}</div></div>}
                <p className="aiPrivacyNote"><Info size={14}/> This is preliminary guidance based on published criteria, not an official allocation or approval.</p>
              </section>
            </div>
          </>}

          {page === 'guide' && <>
            <div className="pageTitle"><div><div className="eyebrow">KNOW THE PROCESS</div><h1>Housing guide<span className="period">.</span></h1><p>A clearer overview of the housing application journey.</p></div></div><div className="guideBanner"><div><BookOpen size={22}/><span>UNDERSTANDING HOUSING ASSISTANCE</span></div><h2>Good information is the first step toward a better application.</h2><p>Requirements vary between housing programmes and municipalities. Always confirm final eligibility and allocation decisions with the authorised housing authority.</p></div><div className="guideGrid">{[
            { icon: ClipboardList, title: 'Prepare your application', text: 'Start by gathering accurate information about your household and housing circumstances. Requirements depend on the relevant programme.' },
            { icon: FileCheck2, title: 'Check your information', text: 'Review your details carefully. Missing or inconsistent information can require additional review or follow-up.' },
            { icon: Clock3, title: 'Follow recorded progress', text: 'Open your applications to see the latest updates recorded in your LandGuard workspace.' },
            { icon: ShieldCheck, title: 'Understand the decisions', text: 'Review recorded changes and their reasons. Official housing eligibility and allocations are determined by authorised institutions.' }
          ].map(({ icon: Icon, title, text }) => <div className="guideCard" key={title}><span className="guideIcon"><Icon size={23}/></span><h3>{title}</h3><p>{text}</p></div>)}</div><div className="guideAction"><div><h3>Ready to get organised?</h3><p>{applicant ? 'Create a housing application record and start tracking its progress.' : 'Return to the application register to see recorded information.'}</p></div><button className="button primary" onClick={() => go(applicant ? 'new' : 'applications')}>{applicant ? 'New application' : 'View applications'} <ArrowRight size={17}/></button></div>
          </>}
        </main>
        <footer className="appFooter"><span>© {new Date().getFullYear()} LandGuard Africa</span><span>Independent housing assistance and accountability platform</span></footer>
      </div>
    </div>}
  </div>
}
