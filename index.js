// index.js com bcryptjs e CORS corrigido para produção
import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { OpenAI } from "openai";
import pkg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const { Pool } = pkg;

config();
const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://anamnese-ia-iota.vercel.app"
  ],
  credentials: true
}));

app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.post("/gerar-plano", async (req, res) => {
  const { respostas, tipo } = req.body;
  if (!respostas || !Array.isArray(respostas) || respostas.length === 0) {
    return res.status(400).json({ error: "Respostas inválidas" });
  }
  if (!tipo || (tipo !== "alimentacao" && tipo !== "treino")) {
    return res.status(400).json({ error: "Tipo inválido. Use 'alimentacao' ou 'treino'" });
  }
  let promptBase = "";
  if (tipo === "alimentacao") {
    promptBase = `Sou um nutricionista. Com base nas respostas abaixo, gere um plano alimentar personalizado para a pessoa, considerando saúde, equilíbrio nutricional e seus objetivos:`;
  } else if (tipo === "treino") {
    promptBase = `Sou um personal trainer. Com base nas respostas abaixo, gere um plano de treino personalizado, levando em conta segurança, frequência recomendada e objetivos da pessoa:`;
  }

  const prompt = `${promptBase}\n${respostas.map((r, i) => `Pergunta ${i + 1}: ${r}`).join("\n")}`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-3.5-turbo",
    });

    const plano = completion.choices[0]?.message?.content;

    await pool.query(
      "INSERT INTO anamneses (tipo, respostas, plano, criado_em) VALUES ($1, $2, $3, NOW())",
      [tipo, JSON.stringify(respostas), plano]
    );

    return res.json({ plano });
  } catch (error) {
    console.error("Erro ao gerar plano:", error);
    return res.status(500).json({ error: "Erro ao gerar plano" });
  }
});

app.post("/auth/register", async (req, res) => {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes" });
  }

  try {
    const usuarioExistente = await pool.query("SELECT * FROM usuarios WHERE email = $1", [email]);
    if (usuarioExistente.rows.length > 0) {
      return res.status(400).json({ error: "E-mail já cadastrado." });
    }

    const hash = await bcrypt.hash(senha, 10);
    const result = await pool.query(
      "INSERT INTO usuarios (nome, email, senha, criado_em) VALUES ($1, $2, $3, NOW()) RETURNING id, nome, email",
      [nome, email, hash]
    );

    const token = jwt.sign({ id: result.rows[0].id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({ usuario: result.rows[0], token });
  } catch (err) {
    console.error("Erro ao registrar usuário:", err);
    res.status(500).json({ error: "Erro ao registrar" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, senha } = req.body;

  try {
    const result = await pool.query("SELECT * FROM usuarios WHERE email = $1", [email]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(senha, user.senha))) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ token, usuario: { id: user.id, nome: user.nome, email: user.email } });
  } catch (err) {
    console.error("Erro ao fazer login:", err);
    res.status(500).json({ error: "Erro ao fazer login" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
