// ==== File: backend/controllers/answerController.js ====
const UserAnswer = require('../models/UserAnswer');

/**
 * Submit an answer to a question
 * @route POST /answers/questions/:questionId/submit
 */
const submitUserAnswer = async (req, res) => {
  try {
    const { questionId } = req.params;
    const userId = req.user.id;
    const { selectedOptionIds, answerText } = req.body; // Frontend sends one or the other based on question type

    // Basic validation
    if (!questionId) {
      return res.status(400).json({ code: 'INVALID_REQUEST', message: 'Question ID is required.' });
    }
    if ((!selectedOptionIds || selectedOptionIds.length === 0) && (answerText === null || answerText === undefined)) {
      return res.status(400).json({ code: 'INVALID_REQUEST', message: 'Either selected options or answer text must be provided.' });
    }

    const result = await UserAnswer.submitAnswer(userId, questionId, selectedOptionIds, answerText);
    
    res.status(201).json({
      message: 'Answer submitted successfully.',
      data: result // Contains the answer, its correctness, lessonId, and new lessonScore
    });

  } catch (error) {
    console.error('Submit answer error:', error);
    if (error.message === 'Question not found.') {
      return res.status(404).json({ code: 'QUESTION_NOT_FOUND', message: 'Вопрос не найден.' });
    } else if (error.message === 'User not enrolled in the course containing this question.') {
      return res.status(403).json({ code: 'NOT_ENROLLED', message: 'Вы не записаны на курс, содержащий этот вопрос.' });
    }
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Ошибка при отправке ответа.' });
  }
};

module.exports = {
  submitUserAnswer,
};