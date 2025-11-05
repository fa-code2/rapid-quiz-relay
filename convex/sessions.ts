// convex/sessions.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Helper function to generate a 6-char code
const generateJoinCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Admin: Create a new quiz session (live room)
export const createSession = mutation({
  args: { 
    quizId: v.id("quizzes"),
    hostId: v.string(), // Frontend provides this
  },
  handler: async (ctx, args) => {
    // Optional: Check if hostId matches quiz.creatorId
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz || quiz.creatorId !== args.hostId) {
        throw new Error("You are not authorized to host this quiz.");
    }

    // Generate a unique join code
    let join_code: string | undefined;
    let attempts = 0;
    do {
      join_code = generateJoinCode();
      const existing = await ctx.db
        .query("quiz_sessions")
        .withIndex("by_join_code", (q) => q.eq("join_code", join_code!))
        .first();
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      throw new Error("Failed to generate a unique join code.");
    }

    // Create the session
    const sessionId = await ctx.db.insert("quiz_sessions", {
      quizId: args.quizId,
      hostId: args.hostId,
      join_code: join_code!,
      status: "waiting",
      current_question_index: 0,
      show_leaderboard: false,
    });

    return sessionId;
  },
});

// Player: Join a session (This is PUBLIC)
export const joinSession = mutation({
  args: {
    join_code: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("quiz_sessions")
      .withIndex("by_join_code", (q) => q.eq("join_code", args.join_code.toUpperCase()))
      .first();

    if (!session) {
      throw new Error("Quiz code not found.");
    }

    if (session.status !== "waiting") {
      throw new Error("This quiz is no longer accepting new players.");
    }

    const participantId = await ctx.db.insert("participants", {
      sessionId: session._id,
      name: args.name,
      score: 0,
    });

    return { sessionId: session._id, participantId };
  },
});

// Admin: Get all data for the host screen (REACTIVE)
export const getHostSessionData = query({
  args: { sessionId: v.id("quiz_sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null; 

    const quiz = await ctx.db.get(session.quizId);
    if (!quiz) return null;

    const questions = await ctx.db
      .query("questions")
      .withIndex("by_quizId_order", (q) => q.eq("quizId", quiz._id))
      .order("asc")
      .collect();
      
    const participants = await ctx.db
      .query("participants")
      .withIndex("by_sessionId_score", (q) => q.eq("sessionId", args.sessionId))
      .order("desc") // Sorts by score
      .collect();

    const currentQuestion = questions[session.current_question_index] || null;

    // ** THIS IS THE NEWLY ADDED CODE FOR ADMIN ANALYTICS **
    let answerStats: Record<string, number> = {};
    if (session.show_leaderboard && currentQuestion) {
      const answers = await ctx.db
        .query("answers")
        .withIndex("by_session_question", (q) => 
          q.eq("sessionId", args.sessionId)
           .eq("questionId", currentQuestion._id)
        )
        .collect();
        
      answerStats = answers.reduce((acc, ans) => {
        acc[ans.answer] = (acc[ans.answer] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      ['A', 'B', 'C', 'D'].forEach(opt => {
        if (answerStats[opt] === undefined) answerStats[opt] = 0;
      });
    }
    // ** END OF NEWLY ADDED CODE **

    return { session, quiz, questions, participants, currentQuestion, answerStats };
  },
});

// Player: Get data for the play screen (REACTIVE & PUBLIC)
export const getPlayerSessionData = query({
  args: { 
    sessionId: v.id("quiz_sessions"), 
    participantId: v.id("participants") 
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    const participant = await ctx.db.get(args.participantId);
    if (!participant || participant.sessionId !== args.sessionId) return null;

    const questions = await ctx.db
      .query("questions")
      .withIndex("by_quizId_order", (q) => q.eq("quizId", session.quizId))
      .order("asc")
      .collect();
      
    const currentQuestion = questions[session.current_question_index] || null;

    const allParticipants = await ctx.db
      .query("participants")
      .withIndex("by_sessionId_score", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .collect();
      
    let answerStats: Record<string, number> = {};
    let hasAnswered = false;

    if (currentQuestion) {
      // Check if this player has answered the current question
      const answerDoc = await ctx.db.query("answers")
        .withIndex("by_participant_question", q => 
          q.eq("participantId", args.participantId)
           .eq("questionId", currentQuestion._id)
        ).first();
      hasAnswered = !!answerDoc;

      // Get answer stats if leaderboard is shown
      if (session.show_leaderboard) {
        const answers = await ctx.db
          .query("answers")
          .withIndex("by_session_question", (q) => 
            q.eq("sessionId", args.sessionId)
             .eq("questionId", currentQuestion._id)
          )
          .collect();
          
        answerStats = answers.reduce((acc, ans) => {
          acc[ans.answer] = (acc[ans.answer] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        ['A', 'B', 'C', 'D'].forEach(opt => {
          if (answerStats[opt] === undefined) answerStats[opt] = 0;
        });
      }
    }

    return { 
      session, 
      participant, 
      allParticipants, 
      currentQuestion, 
      answerStats,
      hasAnswered
    };
  },
});