const fs = require('fs');
const file = 'src/features/requests/components/LeaveRequestForm.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `                                                  <td className="px-2 py-4 border-l-2 border-black text-center">
                                                      {isCancelled ? (
                                                          <span className="text-black font-bold">ملغاة</span>
                                                      ) : (
                                                          <span className="text-black font-bold">معتمد</span>
                                                      )}
                                                  </td>
                                                  <td className="px-2 py-4 text-center font-bold text-black text-lg">
                                                      {historicBalance}
                                                  </td>
                                              </tr>
                                          );
                                      })}`;

// Normalize line endings to test
content = content.replace(/\r\n/g, '\n');
const normalizedTarget = targetStr.replace(/\r\n/g, '\n');

if (content.includes(normalizedTarget)) {
    content = content.replace(normalizedTarget, '');
    fs.writeFileSync(file, content, 'utf8');
    console.log('Cleaned successfully!');
} else {
    console.log('Target not found in content');
}
