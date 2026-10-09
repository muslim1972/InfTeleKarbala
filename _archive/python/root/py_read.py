import pandas as pd
df = pd.read_excel('/tmp/sample.xlsx')
print('COLUMNS:', df.columns.tolist())
print('ROW 0:', df.head(1).to_dict('records')[0])
