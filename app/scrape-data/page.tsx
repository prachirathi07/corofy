'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ScrapeDataPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: scrapeData, error } = await supabase
                    .from('scrape_data')
                    .select('*');

                if (error) {
                    throw error;
                }

                setData(scrapeData || []);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return <div className="p-8 text-center">Loading...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Scraped Data</h1>
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200">
                    <thead>
                        <tr>
                            {data.length > 0 && Object.keys(data[0]).map((key) => (
                                <th key={key} className="px-4 py-2 border-b text-left font-medium text-gray-700">
                                    {key}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                                {Object.values(row).map((value: any, i) => (
                                    <td key={i} className="px-4 py-2 border-b text-gray-600">
                                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {data.length === 0 && <p className="text-center mt-4">No data found.</p>}
            </div>
        </div>
    );
}
