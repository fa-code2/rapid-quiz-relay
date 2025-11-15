import { useState, useEffect } from "react"; // <-- 1. Import useEffect
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth, useUser } from "@clerk/clerk-react"; // <-- 2. Import Clerk hooks

const JoinQuiz = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const { isSignedIn } = useAuth(); // <-- 3. Get auth status
  const { user } = useUser(); // <-- 4. Get user object

  // 5. This effect will run when the component loads
  // and whenever the user's login status changes.
  useEffect(() => {
    // If the user is signed in and we have their user info,
    // automatically set their name.
    if (isSignedIn && user?.fullName) {
      setName(user.fullName);
    }
  }, [isSignedIn, user?.fullName]); // Dependency array

  // 3. Get the joinSession mutation
  const joinSessionMutation = useMutation(api.sessions.joinSession);

  const joinQuiz = async () => {
    if (!code.trim() || !name.trim()) {
      toast({ 
        title: "Missing Information", 
        description: "Please enter both quiz code and your name",
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);
    try {
      // 4. Call the mutation
      const { sessionId, participantId } = await joinSessionMutation({
        join_code: code.toUpperCase(),
        name: name,
      });
      
      // 5. Navigate to the play screen on success
      navigate(`/play/${sessionId}?participant=${participantId}`);

  } catch (error: any) {
      // If the session has already started, the server throws a message indicating
      // the quiz is no longer accepting new players. Show a clearer toast in that case.
      const serverMessage = error?.message ? String(error.message) : "";
      let description = "An unknown error occured."; // intentionally the user's spelling

      if (/no longer accepting/i.test(serverMessage) || /already started/i.test(serverMessage)) {
        description = "Quiz has already started.";
      }

      toast({ 
        title: "Failed to Join", 
        description,
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  // 6. The "waiting" screen logic has been removed.
  // The PlayQuiz page will now handle all states: waiting, active, and finished.

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-accent/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 bg-card border-border border-x-primary-foreground-30 rounded-3xl shadow-2xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6 text-primary hover:text-primary hover:bg-primary/10 hover: rounded-full"
        >
          <ArrowLeft className=" h-4 w-4" />
          Back
        </Button>

        <h1 className="text-4xl font-bold mb-2 text-primary">
          Join Quiz
        </h1>
        <p className="text-muted-foreground mb-8">
          Enter the quiz code to get started
        </p>

        <div className="space-y-6">
          <div>
            <Label htmlFor="code" className="text-foreground">Quiz Code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              maxLength={6}
              className="mt-2 text-center text-xl lg:text-2xl font-bold tracking-widest rounded-xl bg-input border-border placeholder:text-sm md:placeholder:text-sm"
            />
          </div>

          {/* --- 6. START: This block is now updated --- */}
          <div>
            <Label htmlFor="name" className="text-foreground">Your Name</Label>
            <Input
              id="name"
              value={name} // This is now pre-filled by the useEffect
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              readOnly={isSignedIn} // Make it read-only if signed in
              className="mt-2 bg-input border-border rounded-xl font-bold text-foreground read-only:bg-muted read-only:text-muted-foreground read-only:cursor-default"
            />
          </div>
          {/* --- END: This block is now updated --- */}

          <div className="flex justify-center">
            <Button
              onClick={joinQuiz}
              disabled={loading}
              size="lg"
              className="w-48 bg-primary text-primary-foreground hover:bg-primary/80 rounded-full border border-primary-foreground-30"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
              ) : (
                "Join Quiz"
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default JoinQuiz;
