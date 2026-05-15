import AdminSidebar from './AdminSidebar';
import AdminTopbar, { type Crumb } from './AdminTopbar';

type Props = {
  breadcrumb?: Crumb[];
  title: string;
  children: React.ReactNode;
};

export default function AdminShell({ breadcrumb, title, children }: Props) {
  return (
    <div className="min-h-screen bg-kore-cream flex">
      <AdminSidebar />
      <div className="flex-1 xl:ml-64 flex flex-col min-w-0">
        <AdminTopbar breadcrumb={breadcrumb} title={title} />
        <main className="flex-1 px-5 xl:px-10 py-6 xl:py-8 pb-24 xl:pb-20">{children}</main>
      </div>
    </div>
  );
}
