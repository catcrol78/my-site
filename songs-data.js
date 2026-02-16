tasks: [
  {
    type: "gapfill",                // тип задания
    title: { ru: "Вставь пропуски", es: "Completa los espacios" },
    instruction: { ru: "Вставь правильные формы глаголов", es: "Inserta las formas correctas de los verbos" },
    text: "Yo ___ (ir) a la playa. Tú ___ (querer) bailar.",   // текст с ___ для пропусков
    answers: ["voy", "quieres"],     // правильные ответы
    options: [                       // варианты для выпадающего списка (если нужно)
      ["voy", "vas", "va"],
      ["quiero", "quieres", "quiere"]
    ]
  },
  {
    type: "match",
    title: { ru: "Сопоставь слова", es: "Empareja las palabras" },
    pairs: [
      { left: "casa", right: "дом" },
      { left: "perro", right: "собака" },
      { left: "gato", right: "кот" }
    ]
  },
  {
    type: "quiz",
    title: { ru: "Выбери правильный ответ", es: "Elige la respuesta correcta" },
    questions: [
      {
        question: "¿Cómo se dice 'дом' en español?",
        options: ["casa", "perro", "gato"],
        correct: 0
      }
    ]
  }
]
