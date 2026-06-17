import { app, PORT } from "./server/index.js"

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
