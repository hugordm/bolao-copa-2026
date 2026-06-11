const ERROR_MAP: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'Email ou senha incorretos'],
  [/user already registered/i, 'Email já cadastrado'],
  [/already registered/i, 'Email já cadastrado'],
  [/password should be at least/i, 'Senha muito curta'],
  [/email not confirmed/i, 'Email não confirmado. Verifique sua caixa de entrada'],
  [/user not found/i, 'Usuário não encontrado'],
  [/email rate limit exceeded/i, 'Muitas tentativas. Aguarde alguns instantes e tente novamente'],
  [/for security purposes/i, 'Por segurança, aguarde alguns instantes antes de tentar novamente'],
  [/invalid email/i, 'Email inválido'],
  [/network/i, 'Erro de conexão. Verifique sua internet e tente novamente'],
]

export function translateAuthError(message: string, fallback: string): string {
  for (const [pattern, translation] of ERROR_MAP) {
    if (pattern.test(message)) return translation
  }
  return fallback
}
