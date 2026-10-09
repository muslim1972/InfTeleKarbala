import sys
content=sys.stdin.read()
content=content.replace('<FinancialInput', '<FinancialInput\n                                      financialData={financialData}')
sys.stdout.write(content)
