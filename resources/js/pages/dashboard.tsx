import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import {
    AlertCircle,
    Award,
    CheckCircle,
    Clock,
    FileCheck,
    FileText,
    Plus,
    XCircle,
} from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
];

interface DashboardProps {
    user: {
        id: string;
        name: string;
        email: string;
        role: 'admin' | 'pimpinan' | 'pengaju';
    };
    stats: {
        total_documents: number;
        pending_reviews: number;
        total_templates: number;
        total_certificates: number;
    };
    recent_documents: Array<{
        id: string;
        title: string;
        number: string;
        created_at: string;
        user: { name: string };
        toUser: { name: string };
        review: { status: string };
    }>;
}

export default function Dashboard({
    user,
    stats,
    recent_documents,
}: DashboardProps) {
    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'admin':
                return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            case 'pimpinan':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
            case 'pengaju':
                return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'rejected':
                return <XCircle className="h-4 w-4 text-red-500" />;
            case 'pending':
                return <AlertCircle className="h-4 w-4 text-yellow-500" />;
            default:
                return <Clock className="h-4 w-4 text-gray-500" />;
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard - Sisign" />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Selamat datang, {user.name}!
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Sistem Informasi Pengajuan Dokumen dan Tanda Tangan
                            Digital
                        </p>
                    </div>
                    <div
                        className={`rounded-full px-3 py-1 text-sm font-medium ${getRoleBadgeColor(user.role)}`}
                    >
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl bg-gradient-to-r from-green-500 to-green-600 p-6 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-green-100">Total Dokumen</p>
                                <p className="text-3xl font-bold">
                                    {stats.total_documents}
                                </p>
                            </div>
                            <FileText className="h-8 w-8 text-green-200" />
                        </div>
                    </div>

                    <div className="rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 p-6 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-yellow-100">
                                    Menunggu Review
                                </p>
                                <p className="text-3xl font-bold">
                                    {stats.pending_reviews}
                                </p>
                            </div>
                            <Clock className="h-8 w-8 text-yellow-200" />
                        </div>
                    </div>

                    <div className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-blue-100">
                                    Template Sertifikat
                                </p>
                                <p className="text-3xl font-bold">
                                    {stats.total_templates}
                                </p>
                            </div>
                            <FileCheck className="h-8 w-8 text-blue-200" />
                        </div>
                    </div>

                    <div className="rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 p-6 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-purple-100">
                                    Total Sertifikat
                                </p>
                                <p className="text-3xl font-bold">
                                    {stats.total_certificates}
                                </p>
                            </div>
                            <Award className="h-8 w-8 text-purple-200" />
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                    <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                        Aksi Cepat
                    </h2>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Link href="/documents/create" className="block">
                            <div className="flex items-center rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50">
                                <Plus className="mr-3 h-5 w-5 text-green-600" />
                                <div>
                                    <p className="font-medium text-gray-900">
                                        Ajukan Dokumen
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        Buat pengajuan baru
                                    </p>
                                </div>
                            </div>
                        </Link>

                        <Link href="/documents" className="block">
                            <div className="flex items-center rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50">
                                <FileText className="mr-3 h-5 w-5 text-blue-600" />
                                <div>
                                    <p className="font-medium text-gray-900">
                                        Lihat Dokumen
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        Kelola dokumen
                                    </p>
                                </div>
                            </div>
                        </Link>

                        {user.role === 'admin' && (
                            <>
                                <Link
                                    href="/templates/create"
                                    className="block"
                                >
                                    <div className="flex items-center rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50">
                                        <FileCheck className="mr-3 h-5 w-5 text-purple-600" />
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                Buat Template
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                Template sertifikat
                                            </p>
                                        </div>
                                    </div>
                                </Link>

                                <Link
                                    href="/certificates/bulk/create"
                                    className="block"
                                >
                                    <div className="flex items-center rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50">
                                        <Award className="mr-3 h-5 w-5 text-orange-600" />
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                Bulk Sertifikat
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                Generate dari Excel
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            </>
                        )}
                    </div>
                </div>

                {/* Recent Documents */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                    <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                        Dokumen Terbaru
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                    <th className="pb-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                                        Judul Dokumen
                                    </th>
                                    <th className="pb-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                                        Nomor
                                    </th>
                                    <th className="pb-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                                        Pengaju
                                    </th>
                                    <th className="pb-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                                        Tujuan
                                    </th>
                                    <th className="pb-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                                        Status
                                    </th>
                                    <th className="pb-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                                        Tanggal
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {recent_documents.map((doc) => (
                                    <tr
                                        key={doc.id}
                                        className="border-b border-gray-100 dark:border-gray-700"
                                    >
                                        <td className="py-3 text-sm text-gray-900 dark:text-white">
                                            {doc.title}
                                        </td>
                                        <td className="py-3 text-sm text-gray-600 dark:text-gray-400">
                                            {doc.number}
                                        </td>
                                        <td className="py-3 text-sm text-gray-600 dark:text-gray-400">
                                            {doc.user.name}
                                        </td>
                                        <td className="py-3 text-sm text-gray-600 dark:text-gray-400">
                                            {doc.toUser.name}
                                        </td>
                                        <td className="py-3">
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(
                                                    doc.review.status,
                                                )}
                                                <span className="text-sm text-gray-600 capitalize dark:text-gray-400">
                                                    {doc.review.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 text-sm text-gray-600 dark:text-gray-400">
                                            {new Date(
                                                doc.created_at,
                                            ).toLocaleDateString('id-ID')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
