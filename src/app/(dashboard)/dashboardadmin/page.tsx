'use client'

import {
  User,
  LogOut,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  BookOpenCheck,
  FilterX, // Icon untuk tombol reset filter
  CalendarDays 
} from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Toaster } from 'react-hot-toast'
import {
  LineChart, 
  Line,      
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { endOfMonth, eachDayOfInterval, format } from 'date-fns' 

// --- MAIN DASHBOARD ---
export default function DashboardAdmin() {
  const router = useRouter()
  const [userData, setUserData] = useState({ fullName: 'Loading...', email: 'loading@kppn.go.id' })
  const [totalPegawai, setTotalPegawai] = useState<number>(0)
  
  // State untuk Filter (Default: 'all' yang berarti tanpa filter)
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  
  // State untuk data grafik (Absen dan Logbook digabung agar sinkron)
  const [chartData, setChartData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

  // Fetch Profile, Total Pegawai, dan Data Grafik
  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { 
          router.replace('/login')
          return 
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name,email,role')
          .eq('id', user.id)
          .single()

        // RBAC CHECK
        const allowedRoles = ['admin', 'kepala_kantor', 'kasubbag']
        if (!allowedRoles.includes(profile?.role)) {
          router.replace('/dashboard')
          return
        }

        setUserData({ 
          fullName: profile?.full_name || 'Admin', 
          email: user.email || 'N/A' 
        })

        // 1. Fetch Data Pegawai
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, position, role')
          .neq('role', 'admin')

        if (profilesData) {
          const pegawaiCount = profilesData.filter(p => p.role === 'pegawai').length
          setTotalPegawai(pegawaiCount)
        }

        // 2. Tentukan Rentang Waktu berdasarkan Filter
        let startDateStr = ''
        let endDateStr = ''

        if (selectedYear !== 'all') {
          if (selectedMonth !== 'all') {
            // Jika filter sampai ke bulan tertentu
            const startDateObj = new Date(Number(selectedYear), Number(selectedMonth), 1)
            const endDateObj = endOfMonth(startDateObj)
            startDateStr = format(startDateObj, 'yyyy-MM-dd')
            endDateStr = format(endDateObj, 'yyyy-MM-dd')
          } else {
            // Jika filter hanya tahun
            startDateStr = `${selectedYear}-01-01`
            endDateStr = `${selectedYear}-12-31`
          }
        }

        // 3. Siapkan Kerangka Data Agregasi Sumbu X
        const aggregation: Record<string, any> = {}

        if (selectedYear !== 'all' && selectedMonth === 'all') {
          // Kerangka 12 Bulan (Tampilan Per Tahun)
          monthNames.forEach((m, idx) => {
            aggregation[m] = { name: m, TepatWaktu: 0, Terlambat: 0, LuarRadius: 0, TotalLogbook: 0, sortKey: idx }
          })
        } else if (selectedYear !== 'all' && selectedMonth !== 'all') {
          // Kerangka 30/31 Hari (Tampilan Per Bulan)
          const startDateObj = new Date(Number(selectedYear), Number(selectedMonth), 1)
          const daysInMonth = eachDayOfInterval({ start: startDateObj, end: endOfMonth(startDateObj) })
          daysInMonth.forEach(day => {
            const dayStr = format(day, 'yyyy-MM-dd')
            const dayLabel = format(day, 'dd') 
            aggregation[dayStr] = { name: dayLabel, TepatWaktu: 0, Terlambat: 0, LuarRadius: 0, TotalLogbook: 0, sortKey: day.getTime() }
          })
        }
        // Jika filter 'all', kerangka akan dibuat secara dinamis di bawah berdasarkan data yang ada

        // 4. Fetch Data Attendances (Kedisiplinan)
        let attQuery = supabase.from('attendances').select('attendance_date, shift, check_in, check_in_distance_m, user_id')
        if (startDateStr && endDateStr) {
          attQuery = attQuery.gte('attendance_date', startDateStr).lte('attendance_date', endDateStr)
        }
        const { data: attData } = await attQuery

        if (attData) {
          attData.forEach((curr: any) => {
            if (!curr.attendance_date) return
            
            const dateObj = new Date(curr.attendance_date)
            let key = ''

            if (selectedYear === 'all') {
              const mName = monthNames[dateObj.getMonth()].substring(0, 3) // Jan, Feb, dst
              key = `${mName} ${dateObj.getFullYear()}`
              if (!aggregation[key]) {
                aggregation[key] = { name: key, TepatWaktu: 0, Terlambat: 0, LuarRadius: 0, TotalLogbook: 0, sortKey: new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).getTime() }
              }
            } else if (selectedMonth === 'all') {
              key = monthNames[dateObj.getMonth()]
            } else {
              key = curr.attendance_date
            }

            if (!aggregation[key]) return

            // Hitung Luar Radius
            if (curr.check_in_distance_m && curr.check_in_distance_m > 50) {
              aggregation[key].LuarRadius += 1
            }

            // Hitung Tepat Waktu & Terlambat
            if (curr.check_in) {
              const empProfile = profilesData?.find(p => p.id === curr.user_id)
              const userPos = (empProfile?.position || '').toUpperCase()
              const shiftStr = (curr.shift || '').toLowerCase()
              
              let lockHour = 8; let lockMin = 0;
              if (shiftStr.includes('pagi')) {
                if (userPos.includes('SATPAM')) { lockHour = 7; lockMin = 5; }
                else if (userPos.includes('CS')) { lockHour = 7; lockMin = 30; }
                else { lockHour = 8; lockMin = 0; }
              } else {
                if (userPos.includes('SATPAM')) { lockHour = 18; lockMin = 5; }
                else { lockHour = 19; lockMin = 0; }
              }

              const checkInTime = new Date(curr.check_in)
              const shiftLimit = new Date(checkInTime)
              shiftLimit.setHours(lockHour, lockMin, 0, 0)

              if (checkInTime > shiftLimit) {
                aggregation[key].Terlambat += 1
              } else {
                aggregation[key].TepatWaktu += 1
              }
            }
          })
        }

        // 5. Fetch Data Logbook
        let logQuery = supabase.from('vlogbook').select('attendance_date')
        if (startDateStr && endDateStr) {
          logQuery = logQuery.gte('attendance_date', startDateStr).lte('attendance_date', endDateStr)
        }
        const { data: logbookData } = await logQuery

        if (logbookData) {
          logbookData.forEach((curr: any) => {
            if (!curr.attendance_date) return
            
            const dateObj = new Date(curr.attendance_date)
            let key = ''

            if (selectedYear === 'all') {
              const mName = monthNames[dateObj.getMonth()].substring(0, 3)
              key = `${mName} ${dateObj.getFullYear()}`
              if (!aggregation[key]) {
                aggregation[key] = { name: key, TepatWaktu: 0, Terlambat: 0, LuarRadius: 0, TotalLogbook: 0, sortKey: new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).getTime() }
              }
            } else if (selectedMonth === 'all') {
              key = monthNames[dateObj.getMonth()]
            } else {
              key = curr.attendance_date
            }

            if (!aggregation[key]) return
            aggregation[key].TotalLogbook += 1 
          })
        }

        // Urutkan data berdasarkan waktu (sortKey)
        const finalChartData = Object.values(aggregation).sort((a: any, b: any) => a.sortKey - b.sortKey)
        setChartData(finalChartData)

      } catch (err) { 
        console.error(err) 
      } finally { 
        setIsLoading(false) 
      }
    }

    init()
  }, [router, selectedMonth, selectedYear]) 

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await supabase.auth.signOut()
    router.replace('/login')
  }

  // Fungsi dinamis untuk judul grafik
  const getChartTitleSuffix = () => {
    if (selectedYear === 'all') return '(Semua Waktu)'
    if (selectedMonth === 'all') return `(Tahun ${selectedYear})`
    return `(${monthNames[Number(selectedMonth)]} ${selectedYear})`
  }

// Fungsi dinamis untuk keterangan Tooltip grafik
  const formatTooltipLabel = (label: any) => {
    const safeLabel = String(label || '');
    if (selectedYear === 'all') return `Periode: ${safeLabel}`
    if (selectedMonth === 'all') return `Bulan: ${safeLabel} ${selectedYear}`
    return `Tanggal ${safeLabel} ${monthNames[Number(selectedMonth)]} ${selectedYear}`
  }

  if (isLoading || isLoggingOut) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-700" />
        <p className="mt-4 text-slate-600 font-semibold">{isLoggingOut ? 'Menutup Sesi...' : 'Memuat Dashboard Admin...'}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-10">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="bg-blue-900 text-white p-6 pb-20 shadow-xl rounded-b-3xl">
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
              <User size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-wide">{userData.fullName}</h1>
              <p className="text-xs text-blue-200 font-medium opacity-90">{userData.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="bg-red-500/20 hover:bg-red-500 p-2.5 rounded-xl text-white transition border border-white/10">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="px-5 -mt-12 flex flex-col gap-6 max-w-5xl mx-auto">
        
        {/* Top Section: Stats Card & Filter */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-white p-5 rounded-2xl shadow-md border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Pegawai Aktif</p>
              <p className="text-3xl font-extrabold text-blue-900 mt-1">{totalPegawai} <span className="text-base font-normal text-slate-400">Orang</span></p>
            </div>
            <div className="h-14 w-14 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
              <User size={28} />
            </div>
          </div>

          <div className="md:col-span-1 bg-white p-5 rounded-2xl shadow-md border border-slate-200 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <CalendarDays size={16} className="text-blue-600" />
                Periode Grafik
              </label>
              
              {/* Tombol Clear Filter */}
              {(selectedYear !== 'all' || selectedMonth !== 'all') && (
                <button 
                  onClick={() => { setSelectedYear('all'); setSelectedMonth('all'); }}
                  className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded font-bold hover:bg-red-100 flex items-center gap-1 transition"
                >
                  <FilterX size={12} /> Reset
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <select 
                value={selectedYear} 
                onChange={(e) => {
                  setSelectedYear(e.target.value)
                  // Reset bulan jika mereset tahun
                  if(e.target.value === 'all') setSelectedMonth('all')
                }}
                className="w-1/2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">Semua Tahun</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>

              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                disabled={selectedYear === 'all'} // Disable jika tahun belum dipilih
                className={`w-1/2 p-2.5 border border-slate-200 rounded-lg text-sm font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-500 transition ${selectedYear === 'all' ? 'bg-slate-200 opacity-50 cursor-not-allowed' : 'bg-slate-50 cursor-pointer'}`}
              >
                <option value="all">Semua Bulan</option>
                {monthNames.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* GRAFIK 1: KEDISIPLINAN */}
          <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-blue-600" size={24} />
                <h2 className="text-lg font-bold text-slate-800">Tren Kedisiplinan {getChartTitleSuffix()}</h2>
              </div>
            </div>
            
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip 
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelFormatter={formatTooltipLabel}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '14px' }} />
                  <Line type="monotone" dataKey="TepatWaktu" name="Tepat Waktu" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Terlambat" name="Terlambat" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="LuarRadius" name="Luar Radius" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRAFIK 2: PENGISIAN LOGBOOK */}
          <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <BookOpenCheck className="text-emerald-500" size={24} />
                <h2 className="text-lg font-bold text-slate-800">Kinerja Logbook {getChartTitleSuffix()}</h2>
              </div>
            </div>
            
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip 
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelFormatter={formatTooltipLabel}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '14px' }} />
                  <Line type="monotone" dataKey="TotalLogbook" name="Total Logbook Terisi" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Footer Alert */}
        <div className="text-center pb-6 mt-4">
            <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                <AlertTriangle size={12}/> Aplikasi Smart PPNPN Lhokseumawe
            </p>
        </div>

      </main>
    </div>
  )
}