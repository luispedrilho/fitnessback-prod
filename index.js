import express from "express"
import cors from "cors"
import { config } from "dotenv"
import { OpenAI } from "openai"

config()
const app = express()
app.use(cors())
app.use(express.json())

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

app.post("/gerar-plano", async (req, res) => {
  const { respostas, tipo } = req.body

  console.log("Requisição recebida:", req.body)

  if (!respostas || !Array.isArray(respostas) || respostas.length === 0) {
    return res.status(400).json({ error: "Respostas inválidas" })
  }

  if (!tipo || (tipo !== "alimentacao" && tipo !== "treino")) {
    return res.status(400).json({ error: "Tipo inválido. Use 'alimentacao' ou 'treino'" })
  }

  let promptBase = ""
  if (tipo === "alimentacao") {
    promptBase = `
Sou um nutricionista. Com base nas respostas abaixo, gere um plano alimentar personalizado para a pessoa, considerando saúde, equilíbrio nutricional e seus objetivos:
`
  } else if (tipo === "treino") {
    promptBase = `
Sou um personal trainer. Com base nas respostas abaixo, gere um plano de treino personalizado, levando em conta segurança, frequência recomendada e objetivos da pessoa:
`
  }

  const prompt = `${promptBase}\n${respostas.map((r, i) => `Pergunta ${i + 1}: ${r}`).join("\n")}`

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-3.5-turbo",
    })

    const plano = completion.choices[0]?.message?.content
    return res.json({ plano })
  } catch (error) {
    console.error("Erro ao gerar plano:", error)
    return res.status(500).json({ error: "Erro ao gerar plano" })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))
