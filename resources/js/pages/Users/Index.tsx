import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react'; // Use router instead of Inertia
import {
    Edit,
    Plus,
    Search,
    Trash2,
    User,
    Users,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';

// Define route helpers locally if not available in utils/routes yet, or use Ziggy if configured globally
// For now, I'll assume standard Inertia links, but if routes() utility is used, I should update it.
// To be safe I will use direct paths and method calls or window.route if available,
// but looking at Documents/Index.tsx, it imports `routes` from `@/utils/routes`.
// I will check utils/routes.ts content in the next step, but for now I'll write the code assuming I'll update routes.ts or use string paths.
// Actually, I'll use string paths for now to avoid dependency on routes.ts until I see it.
// Wait, better to be consistent. I'll read routes.ts first.

interface UserType {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'pimpinan' | 'pengaju';
    created_at: string;
}

interface Props {
    users: {
        data: UserType[];
        links: any[];
        meta: any;
    };
    filters: {
        search?: string;
        role?: string;
    };
}

export default function UsersIndex({ users, filters }: Props) {
    const [searchQuery, setSearchQuery] = useState<string>(filters.search || '');
    const [roleFilter, setRoleFilter] = useState<string>(filters.role || 'all');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery !== (filters.search || '')) {
                router.get(
                    '/users',
                    {
                        search: searchQuery || undefined,
                        role: roleFilter !== 'all' ? roleFilter : undefined,
                    },
                    {
                        preserveState: true,
                        preserveScroll: true,
                        only: ['users', 'filters'],
                    }
                );
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleRoleChange = (value: string) => {
        setRoleFilter(value);
        router.get(
            '/users',
            {
                search: searchQuery || undefined,
                role: value !== 'all' ? value : undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
                only: ['users', 'filters'],
            }
        );
    };

    const handleDelete = (id: string) => {
        router.delete(`/users/${id}`, {
            onStart: () => setDeletingId(id),
            onFinish: () => setDeletingId(null),
        });
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'admin':
                return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Admin</Badge>;
            case 'pimpinan':
                return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Pimpinan</Badge>;
            case 'pengaju':
                return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Pengaju</Badge>;
            default:
                return <Badge variant="outline">{role}</Badge>;
        }
    };

    // Helper for pagination links if Pagination component not fully compatible
    const PaginationLinks = ({ links, meta }: { links: any[], meta: any }) => {
        if (!meta || !meta.links) return null;
        return (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6">
                <div className="flex flex-1 justify-between sm:hidden">
                    {links[0]?.url && <Link href={links[0].url} className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Previous</Link>}
                    {links[links.length - 1]?.url && <Link href={links[links.length - 1].url} className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Next</Link>}
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm text-gray-700">
                            Showing <span className="font-medium">{meta.from}</span> to <span className="font-medium">{meta.to}</span> of <span className="font-medium">{meta.total}</span> results
                        </p>
                    </div>
                    <div>
                        <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                            {meta.links.map((link: any, i: number) => (
                                <Link
                                    key={i}
                                    href={link.url || '#'}
                                    className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${link.active ? 'z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'} ${!link.url ? 'pointer-events-none opacity-50' : ''}`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </nav>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <AppLayout>
            <Head title="Manajemen User" />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Manajemen User</h1>
                        <p className="text-gray-600">Kelola pengguna dan hak akses</p>
                    </div>
                    <Link href="/users/create">
                        <Button className="bg-indigo-600 hover:bg-indigo-700">
                            <Plus className="mr-2 h-4 w-4" />
                            Tambah User
                        </Button>
                    </Link>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <Users className="mr-2 h-5 w-5" />
                            Daftar Pengguna
                        </CardTitle>
                        <CardDescription>
                            Daftar semua pengguna dalam sistem
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {/* Filters */}
                        <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-end md:items-center">
                            <div className="flex flex-col md:flex-row gap-2 md:items-center w-full md:w-auto">
                                <Select value={roleFilter} onValueChange={handleRoleChange}>
                                    <SelectTrigger className="w-full md:w-[150px]">
                                        <SelectValue placeholder="Filter Role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua Role</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                        <SelectItem value="pimpinan">Pimpinan</SelectItem>
                                        <SelectItem value="pengaju">Pengaju</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="relative w-full md:w-72">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <Input
                                    placeholder="Cari nama atau email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 pr-10"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nama</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Terdaftar Sejak</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.data.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-3 text-gray-500">
                                                    <User className="h-4 w-4" />
                                                </div>
                                                {user.name}
                                            </div>
                                        </TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                                        <TableCell>
                                            {new Date(user.created_at).toLocaleDateString('id-ID', {
                                                day: 'numeric',
                                                month: 'long',
                                                year: 'numeric'
                                            })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end space-x-2">
                                                <Link href={`/users/${user.id}/edit`}>
                                                    <Button variant="outline" size="sm">
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Hapus User?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Apakah Anda yakin ingin menghapus user <strong>{user.name}</strong>?
                                                                Tindakan ini tidak dapat dibatalkan.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Batal</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => handleDelete(user.id)}
                                                                className="bg-red-600 hover:bg-red-700"
                                                                disabled={deletingId === user.id}
                                                            >
                                                                {deletingId === user.id ? 'Menghapus...' : 'Hapus'}
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {users.data.length === 0 && (
                            <div className="p-8 text-center text-gray-500">
                                Tidak ada user ditemukan.
                            </div>
                        )}
                        <div className="mt-4">
                            {/* Use customized Pagination helper or component if accessible */}
                            <PaginationLinks links={users.meta?.links || users.links} meta={users.meta} />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
