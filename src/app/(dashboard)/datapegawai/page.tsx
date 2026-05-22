'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { RefreshCw, User, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Pegawai = {
  id: string;
  full_name: string;
  position: string;
  role: string;
};

export default function DataPegawaiPage() {
  const router = useRouter();
  const [pegawaiList, setPegawaiList] = useState<Pegawai[]>([]);
  const [filteredList, setFilteredList] = useState<Pegawai[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchPegawai = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, position, role')
          .eq('role', 'pegawai');

        if (error) console.error('Error fetching pegawai:', error);
        else {
          setPegawaiList(data || []);
          setFilteredList(data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPegawai();
  }, []);

  useEffect(() => {
    if (!search) setFilteredList(pegawaiList);
    else {
      const lowerSearch = search.toLowerCase();
      setFilteredList(
        pegawaiList.filter(
          (p) =>
            p.full_name.toLowerCase().includes(lowerSearch) ||
            p.position.toLowerCase().includes(lowerSearch)
        )
      );
    }
  }, [search, pegawaiList]);

  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
          <p className="mt-4 text-gray-600 font-medium">Memuat Data Pegawai...</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-6">
      {/* Tombol kembali */}

      <h1 className="text-2xl font-bold text-gray-800 mb-4">Data Pegawai</h1>

      <input
        type="text"
        placeholder="Cari nama atau jabatan..."
        className="mb-6 w-full md:w-1/2 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filteredList.length === 0 ? (
        <p className="text-gray-500">Belum ada pegawai terdaftar atau tidak ditemukan.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredList.map((pegawai, index) => (
            <div
              key={pegawai.id}
              className="p-5 rounded-xl shadow-sm border border-gray-200 bg-white hover:shadow-md transition cursor-pointer"
            >
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                  <User size={28} />
                </div>
                <div>
                  <h2 className="font-semibold text-lg text-gray-800">{pegawai.full_name}</h2>
                  <p className="text-sm text-gray-600">{pegawai.position}</p>
                </div>
              </div>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Role:</span> {pegawai.role}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
