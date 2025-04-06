import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { OpenAI } from "openai"

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

app.post("/gerar-plano", async (req, res) => {
  try {
    const { respostas } = req.body
    const prompt = `
Você é um nutricionista e educador físico. Com base nas informações abaixo, gere um plano alimentar diário e um plano de treino semanal.

Informações do usuário:
${respostas.map((r, i) => `Pergunta ${i + 1}: ${r}`).join("\n")}

Use linguagem simples e amigável.
    `
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }]
    })

    const plano = completion.choices[0].message.content
    res.json({ plano })
  } catch (err) {
    console.error("Erro:", err)
    res.status(500).json({ erro: "Falha ao gerar plano com IA" })
  }
})

app.listen(process.env.PORT || 3001, () => {
  console.log("🔥 Servidor rodando")
})