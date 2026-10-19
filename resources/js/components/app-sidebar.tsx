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
import { index as certificatesIndex } from '@/routes/certificates';
import { index as templatesIndex } from '@/routes/templates';
import { type NavItem, type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { Award, FileCheck } from 'lucide-react';
import AppLogo from './app-logo';

const getMainNavItems = (userRole: string): NavItem[] => {
    const baseItems: NavItem[] = [];

    // Only show template and certificate menus for admin and pimpinan
    if (userRole !== 'pengaju') {
        baseItems.push(
            {
                title: 'Template Sertifikat',
                href: templatesIndex(),
                icon: FileCheck,
            },
            {
                title: 'Sertifikat',
                href: certificatesIndex(),
                icon: Award,
            },
        );
    }

    return baseItems;
};

const footerNavItems: NavItem[] = [];

export function AppSidebar() {
    const { auth } = usePage<SharedData>().props;
    const userRole = String(auth.user.role ?? 'pengaju');
    const mainNavItems = getMainNavItems(userRole);

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={certificatesIndex()} prefetch>
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
