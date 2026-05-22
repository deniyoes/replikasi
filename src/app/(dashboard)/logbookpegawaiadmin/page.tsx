'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import XLSX from 'xlsx-js-style'
import { format, startOfMonth, endOfMonth } from 'date-fns'

interface Attendance {
  id: number
  attendance_date: string
  shift?: string
  status?: string
  full_name: string
  position: string
  uraian_kerja: string
  description: string
}

export default function LogbookPegawaiAdminPage() {
  const router = useRouter()

  /* ================= STATE ================= */
  const [rawData, setRawData] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)

  // FILTER
  const [filterMode, setFilterMode] = useState<'daily' | 'monthly'>('daily')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [search, setSearch] = useState('')

  // PAGINATION
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  /* ================= INIT DATE ================= */
  useEffect(() => {
    const now = new Date()
    setSelectedDate(format(now, 'yyyy-MM-dd'))
    setSelectedMonth(format(now, 'yyyy-MM'))
  }, [])

  /* ================= DATE RANGE (SAFE) ================= */
  const getDateRange = () => {
    if (filterMode === 'daily') {
      const d = selectedDate || format(new Date(), 'yyyy-MM-dd')
      return { start: d, end: d }
    }

    if (!selectedMonth) {
      const now = new Date()
      return {
        start: format(startOfMonth(now), 'yyyy-MM-dd'),
        end: format(endOfMonth(now), 'yyyy-MM-dd')
      }
    }

    const [y, m] = selectedMonth.split('-')
    const start = startOfMonth(new Date(Number(y), Number(m) - 1))
    const end = endOfMonth(start)

    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    }
  }

  /* ================= FETCH BACKEND (DATE ONLY) ================= */
  const fetchData = async () => {
    setLoading(true)
    try {
      const { start, end } = getDateRange()

      const { data, error } = await supabase
        .from('vlogbook')
        .select('*')
        .gte('attendance_date', start)
        .lte('attendance_date', end)
        .order('attendance_date', { ascending: false })

      if (error) throw error
      setRawData(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [filterMode, selectedDate, selectedMonth])

  /* ================= FILTER FRONTEND (NAMA, JABATAN, STATUS) ================= */
  const filteredData = useMemo(() => {
    if (!search) return rawData

    const q = search.toLowerCase()

    return rawData.filter(r =>
      r.full_name?.toLowerCase().includes(q) ||
      r.position?.toLowerCase().includes(q) ||
      r.status?.toLowerCase().includes(q)
    )
  }, [rawData, search])

  /* RESET PAGE */
  useEffect(() => {
    setCurrentPage(1)
  }, [search, filterMode, selectedDate, selectedMonth])

  /* ================= PAGINATION ================= */
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const startIdx = (currentPage - 1) * itemsPerPage
  const pageData = filteredData.slice(startIdx, startIdx + itemsPerPage)

  const getPages = () => {
    if (totalPages <= 7)
      return Array.from({ length: totalPages }, (_, i) => i + 1)

    if (currentPage <= 4)
      return [1, 2, 3, 4, '...', totalPages - 2, totalPages - 1, totalPages]

    if (currentPage >= totalPages - 3)
      return [
        1,
        2,
        '...',
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages
      ]

    return [
      1,
      '...',
      currentPage - 1,
      currentPage,
      currentPage + 1,
      '...',
      totalPages
    ]
  }

  /* ================= EXPORT EXCEL (FILTERED FULL) ================= */
  const exportExcel = () => {
    if (!filteredData.length) return alert('Data kosong')

    const rows = filteredData.map((r, i) => ({
      No: i + 1,
      Nama: r.full_name,
      Jabatan: r.position,
      Tanggal: format(new Date(r.attendance_date), 'dd/MM/yyyy'),
      Shift: r.shift || '-',
      Status: r.status || '-',
      Uraian: r.uraian_kerja || '-'
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Logbook')

    XLSX.writeFile(
      wb,
      filterMode === 'daily'
        ? `Logbook_${selectedDate}.xlsx`
        : `Logbook_${selectedMonth}.xlsx`
    )
  }

  /* ================= RENDER ================= */
  if (loading) return <div className="p-10">Loading...</div>

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* HEADER */}
      <div className="flex justify-between mb-4">
        <button onClick={exportExcel} className="flex gap-2 bg-green-600 text-white px-4 py-2 rounded">
          <FileSpreadsheet /> Export Excel
        </button>
      </div>

      {/* FILTER */}
      <div className="bg-white p-4 rounded mb-4 flex gap-4">
        <input
          placeholder="Cari nama / jabatan / status"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border px-3 py-2 w-64"
        />

        <select value={filterMode} onChange={e => setFilterMode(e.target.value as any)}>
          <option value="daily">Harian</option>
          <option value="monthly">Bulanan</option>
        </select>

        {filterMode === 'daily' ? (
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
        ) : (
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
        )}
      </div>

      {/* TABLE */}
      <table className="w-full bg-white">
        <thead className="bg-blue-900 text-white">
          <tr>
            <th className="p-2">No</th>
            <th className="p-2">Nama</th>
            <th className="p-2">Tanggal</th>
            <th className="p-2">Shift</th>
            <th className="p-2">Status</th>
            <th className="p-2">Uraian</th>
          </tr>
        </thead>
        <tbody>
          {pageData.map((r, i) => (
            <tr key={r.id} className="border-t">
              <td className="p-2 text-center">{startIdx + i + 1}</td>
              <td className="p-2">{r.full_name}</td>
              <td className="p-2">{format(new Date(r.attendance_date), 'dd/MM/yyyy')}</td>
              <td className="p-2">{r.shift}</td>
              <td className="p-2">{r.status}</td>
              <td className="p-2 text-sm">{r.uraian_kerja} <br/> {r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* PAGINATION */}
      <div className="flex justify-center gap-1 mt-4">
        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
          <ChevronLeft />
        </button>

        {getPages().map((p, i) =>
          p === '...' ? (
            <span key={i} className="px-2">...</span>
          ) : (
            <button
              key={i}
              onClick={() => setCurrentPage(p as number)}
              className={`px-3 ${p === currentPage && 'bg-blue-600 text-white'}`}
            >
              {p}
            </button>
          )
        )}

        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
          <ChevronRight />
        </button>
      </div>
    </div>
  )
}
