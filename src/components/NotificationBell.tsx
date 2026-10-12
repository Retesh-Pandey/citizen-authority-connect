import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function NotificationBell({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const { data } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`notif-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (p) => {
        const n = p.new as { title: string; body: string };
        toast(n.title, { description: n.body });
        qc.invalidateQueries({ queryKey: ["notifications", userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc]);

  const unread = data.filter((n) => !n.read).length;
  const toggle = async () => {
    setOpen((o) => !o);
    if (!open && unread) {
      await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
      qc.invalidateQueries({ queryKey: ["notifications", userId] });
    }
  };

  return (
    <div className="relative">
      <button onClick={toggle} aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full bg-secondary">
        <Bell className="size-4" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-30 max-h-96 w-80 overflow-y-auto rounded-3xl border bg-card p-2 shadow-soft">
          {data.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No notifications yet</p>}
          {data.map((n) => (
            <div key={n.id} className={`rounded-2xl p-3 ${n.read ? "" : "bg-accent/50"}`}>
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="text-xs text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
