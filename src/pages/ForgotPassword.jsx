import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleReset = async () => {
    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Password updated!",
      description: "You can now sign in with your new password.",
    });

    navigate("/auth?mode=login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="p-6 max-w-md w-full space-y-4">
        <h2 className="text-xl font-semibold">Choose New Password</h2>

        <Input
          type="password"
          placeholder="New Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button onClick={handleReset} disabled={loading} className="w-full">
          {loading ? "Updating…" : "Update Password"}
        </Button>
      </Card>
    </div>
  );
}
