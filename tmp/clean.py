with open('contributors-api/server.ts', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('async function isChurchPeriodClosed(')
end = content.find('// GET /api/v1/church-closings', start)
fn = content[start:end]

fn_fixed = fn.replace('\\`', '`').replace("\\'", "'").replace('\\${', '${')

content = content[:start] + fn_fixed + content[end:]
with open('contributors-api/server.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('Cleaned backslashes in isChurchPeriodClosed successfully')
