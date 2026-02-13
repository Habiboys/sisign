import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import {
    Award,
    FileCheck,
    FileText,
    LayoutGrid,
    Settings
} from 'lucide-react';
import AppLogo from './app-logo';

const getMainNavItems = (userRole: string): NavItem[] => {
    const baseItems: NavItem[] = [
        {
            title: 'Dashboard',
            href: '/dashboard',
            icon: LayoutGrid,
        },
        {
            title: 'Dokumen',
            href: '/documents',
            icon: FileText,
        },
    ];

    // Only show template and certificate menus for admin and pimpinan
    if (userRole !== 'pengaju') {
        baseItems.push(
            {
                title: 'Template Sertifikat',
                href: '/templates',
                icon: FileCheck,
            },
            {
                title: 'Sertifikat',
                href: '/certificates',
                icon: Award,
            },
        );
    }



    // Add Settings link for all users
    baseItems.push({
        title: 'Settings',
        href: '/settings/profile',
        icon: Settings,
    });

    return baseItems;
};

const footerNavItems: NavItem[] = [];

export function AppSidebar() {
    const { auth } = usePage().props as any;
    const userRole = auth?.user?.role || 'admin';
    const mainNavItems = getMainNavItems(userRole);

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
