// Route helper untuk Laravel routes
export const routes = {
    dashboard: () => '/dashboard',
    documents: {
        index: () => '/documents',
        create: () => '/documents/create',
        show: (id: string) => `/documents/${id}`,
        store: () => '/documents',
        destroy: (id: string) => `/documents/${id}`,
        review: (id: string) => `/documents/${id}/review`,
    },
    templates: {
        index: () => '/templates',
        create: () => '/templates/create',
        show: (id: string) => `/templates/${id}`,
        store: () => '/templates',
        destroy: (id: string) => `/templates/${id}`,
        review: (id: string) => `/templates/${id}/review`,
    },
    certificates: {
        index: () => '/certificates',
        create: () => '/certificates/create',
        show: (id: string) => `/certificates/${id}`,
        view: (id: string) => `/certificates/${id}/view`,
        download: (id: string) => `/certificates/${id}/download`,
        store: () => '/certificates',
        destroy: (id: string) => `/certificates/${id}`,
        bulk: {
            create: () => '/certificates/bulk/create',
            store: () => '/certificates/bulk',
        },
        generateFromExcel: () => '/certificates/generate-from-excel',
        sendEmails: () => '/certificates/send-emails',
    },
    signatures: {
        create: (params?: { document_id?: string; template_id?: string }) => {
            const searchParams = new URLSearchParams();
            if (params?.document_id)
                searchParams.set('document_id', params.document_id);
            if (params?.template_id)
                searchParams.set('template_id', params.template_id);
            return `/signatures/create${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
        },
        store: () => '/signatures',
    },
};
