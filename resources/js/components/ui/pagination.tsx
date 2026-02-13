import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginationProps {
    links: PaginationLink[];
    meta?: {
        current_page: number;
        last_page: number;
        total: number;
        per_page: number;
    };
}

export function Pagination({ links, meta }: PaginationProps) {
    if (!links || links.length <= 3) {
        return null;
    }

    return (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6">
            <div className="flex flex-1 justify-between sm:hidden">
                {links[0].url ? (
                    <Link href={links[0].url as string} preserveScroll>
                        <Button variant="outline" size="sm">
                            Previous
                        </Button>
                    </Link>
                ) : (
                    <Button variant="outline" size="sm" disabled>
                        Previous
                    </Button>
                )}
                {links[links.length - 1].url ? (
                    <Link href={links[links.length - 1].url as string} preserveScroll>
                        <Button variant="outline" size="sm">
                            Next
                        </Button>
                    </Link>
                ) : (
                    <Button variant="outline" size="sm" disabled>
                        Next
                    </Button>
                )}
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm text-gray-700">
                        Showing{' '}
                        <span className="font-medium">
                            {meta ? (meta.current_page - 1) * meta.per_page + 1 : 1}
                        </span>{' '}
                        to{' '}
                        <span className="font-medium">
                            {meta
                                ? Math.min(meta.current_page * meta.per_page, meta.total)
                                : links.length - 2}
                        </span>{' '}
                        of <span className="font-medium">{meta?.total || 0}</span> results
                    </p>
                </div>
                <div>
                    <nav
                        className="isolate inline-flex -space-x-px rounded-md shadow-sm"
                        aria-label="Pagination"
                    >
                        {links.map((link, index) => {
                            // Skip empty labels
                            if (!link.label) return null;

                            // Previous button
                            if (index === 0) {
                                return link.url ? (
                                    <Link
                                        key={`prev-${index}`}
                                        href={link.url as string}
                                        preserveScroll
                                        className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                                    >
                                        <span className="sr-only">Previous</span>
                                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                    </Link>
                                ) : (
                                    <span
                                        key={`prev-${index}`}
                                        className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-300 ring-1 ring-inset ring-gray-300 cursor-not-allowed"
                                    >
                                        <span className="sr-only">Previous</span>
                                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                    </span>
                                );
                            }

                            // Next button
                            if (index === links.length - 1) {
                                return link.url ? (
                                    <Link
                                        key={`next-${index}`}
                                        href={link.url as string}
                                        preserveScroll
                                        className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                                    >
                                        <span className="sr-only">Next</span>
                                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                    </Link>
                                ) : (
                                    <span
                                        key={`next-${index}`}
                                        className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-300 ring-1 ring-inset ring-gray-300 cursor-not-allowed"
                                    >
                                        <span className="sr-only">Next</span>
                                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                    </span>
                                );
                            }

                            // Page numbers
                            if (link.active) {
                                return (
                                    <span
                                        key={index}
                                        aria-current="page"
                                        className="relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                                    >
                                        {link.label}
                                    </span>
                                );
                            }

                            if (link.url) {
                                return (
                                    <Link
                                        key={index}
                                        href={link.url as string}
                                        preserveScroll
                                        className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                                    >
                                        {link.label}
                                    </Link>
                                );
                            }

                            // Ellipsis (...)
                            return (
                                <span
                                    key={index}
                                    className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300"
                                >
                                    {link.label}
                                </span>
                            );
                        })}
                    </nav>
                </div>
            </div>
        </div>
    );
}
