// convex/quizzes.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Admin: Create a new quiz and its questions
export const createQuiz = mutation({
  args: {
    // The frontend will pass a unique ID for the creator
    creatorId: v.string(), 
    title: v.string(),
    description: v.optional(v.string()),
    questions: v.array(
      v.object({
        question_text: v.string(),
        question_image_url: v.string(), // Send empty string if none
        option_a: v.string(),
        option_b: v.string(),
        option_c: v.string(), // Send empty string if none
        option_d: v.string(), // Send empty string if none
        correct_answer: v.string(),
        time_limit: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // 1. Create the Quiz
    const quizId = await ctx.db.insert("quizzes", {
      title: args.title,
      description: args.description,
      creatorId: args.creatorId,
    });

    // 2. Create all associated questions
    for (let i = 0; i < args.questions.length; i++) {
      const q = args.questions[i];
      await ctx.db.insert("questions", {
        quizId: quizId,
        question_text: q.question_text,
        question_image_url: q.question_image_url || undefined,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c || undefined,
        option_d: q.option_d || undefined,
        correct_answer: q.correct_answer,
        time_limit: q.time_limit,
        order_number: i,
      });
    }

    return quizId;
  },
});

// Public: Get Quiz Details for the QuizDetails page
export const getQuizDetails = query({
  args: { id: v.id("quizzes") },
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.id);
    if (!quiz) {
      return null;
    }

    // ** THIS IS THE FIX **
    // 1. Use the new index "by_quizId_order"
    // 2. Use .order("asc") which sorts by `order_number` (the 2nd field in the index)
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_quizId_order", (q) => q.eq("quizId", args.id))
      .order("asc") 
      .collect();

    return { quiz, questions, creatorId: quiz.creatorId };
  },
});