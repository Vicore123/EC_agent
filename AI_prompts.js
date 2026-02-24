const resposta = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content: "You are a CRM assistant (Vinicius Alves Enrollment Counsellor) that generates very short, objective summaries in English only."
          },
          {
            role: "user",
            content: `Summarize the following WhatsApp conversation in English in a maximum of 15 words. Example: "Student unable to access portal and requested password reset."\n\n${conversa.substring(0, 15000)}`
          }
        ]
      });

const resposta = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `
You must return ONLY ONE NUMBER from this list:

0 No response
1 No longer interested
2 Requested more information
3 Learned more about EnglishConnect
4 Interested but scheduling conflict
5 Waiting financial information
6 Needed guidance with application (use this if the student is not admited yet)
7 Technical issue
8 Completed application successfully (use this if the student is admited and you're unsure)
9 Returning student waiting provision
10 Plans to register future term
13 Successfully registered (holds solved is 8, not 13) (just use 13 if I (enrollment counselor) confirm in the chat)

Return only the number.
`
        },
        {
          role: "user",
          content: conversa.substring(0, 15000)
        }
      ]
    });

