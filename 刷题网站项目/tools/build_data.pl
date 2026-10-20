#!/usr/bin/env perl
#
# build_data.pl —— 题库 Markdown -> 结构化数据（单一数据源转换脚本）
#
# 用法:
#   perl tools/build_data.pl [题库目录] [输出目录]
# 默认:
#   perl tools/build_data.pl "C:/Users/Bai/Desktop/新生礼包/2026网页部招新考核/题库" .
#
# 产出:
#   js/data/banks.js   运行时直接 <script> 引入（file:// 双击也能用，不走 fetch）
#   data/banks.json    同一份数据的 JSON（供接口/其他工具使用）
#   data/build-report.md  转换报告：题量核对 + 数据异常清单
#
# 设计说明:
#   1) 题库由多人整理，格式并不统一 —— 所以这里做"容错解析 + 异常登记"，
#      而不是遇到不认识的写法就崩掉或者悄悄改题目。
#   2) 题目内容（题干/选项/答案）一律原样保留，绝不修正；
#      解析不出来的地方只登记到 issues 里，交给前端显式提示用户。
#   3) 判分口径由 js/core/grading.js 统一负责，本脚本只负责"搬运数据"。

use strict;
use warnings;
use utf8;
use File::Path qw(make_path);
use File::Basename qw(basename);
use Encode qw(decode);

binmode(STDOUT, ':encoding(UTF-8)');

my $src_dir = shift(@ARGV) // 'C:/Users/Bai/Desktop/新生礼包/2026网页部招新考核/题库';
my $out_dir = shift(@ARGV) // '.';

my @files = ('Java题库.md', 'Web题库.md');

# 银行 id：文件名里没有可靠的英文标识，用固定映射，保证 id 稳定（localStorage 依赖它）
my %BANK_META = (
  'Java题库.md' => { id => 'java', desc => 'Java 语言基础、面向对象、集合与异常等，适合课程复习与考前突击。' },
  'Web题库.md'  => { id => 'web',  desc => 'HTML / CSS / JavaScript 前端基础，按六个章节组织。' },
);

my %TYPE_MAP = (
  '单选题' => 'single',
  '多选题' => 'multiple',
  '判断题' => 'judge',
);

my @banks;
my @issues;

sub issue {
  my (%a) = @_;
  push @issues, \%a;
}

for my $file (@files) {
  my $path = "$src_dir/$file";
  unless (-e $path) {
    issue(level => 'error', code => 'file-missing', message => "题库文件不存在: $path");
    next;
  }

  open(my $fh, '<:encoding(UTF-8)', $path) or die "打不开 $path: $!";
  my @lines = <$fh>;
  close($fh);
  chomp @lines;

  my $meta  = $BANK_META{$file} or die "缺少 $file 的元数据映射";
  my $bank  = {
    id       => $meta->{id},
    title    => $file,
    subtitle => '',
    desc     => $meta->{desc},
    sourceFile => $file,
    chapters => [],
    questions => [],
  };

  my $chapter;            # 当前章节
  my $q;                  # 当前题目
  my $state = 'idle';     # idle | stem | options | tail
  my $in_code = 0;        # 是否在 ``` 代码块内
  my $header_declared;    # 文件头部声明的题量信息

  my $flush = sub {
    return unless $q;
    # 收尾整理
    $q->{stem} =~ s/\s+$//;
    $q->{stem} =~ s/^\s+//;
    $q->{explanation} =~ s/\s+$// if defined $q->{explanation};
    $q->{stem} =~ s/\n{3,}/\n\n/g;
    push @{ $bank->{questions} }, $q;
    $q = undef;
  };

  for (my $i = 0; $i < @lines; $i++) {
    my $line = $lines[$i];
    my $trim = $line;
    $trim =~ s/^\s+//;
    $trim =~ s/\s+$//;

    # 代码围栏：块内的一切（包括 "- A." 这种）都算题干正文
    if ($trim =~ /^```/) {
      $in_code = !$in_code;
      if ($state eq 'stem' || $state eq 'idle') {
        $q->{stem} .= "\n$line\n" if $q;
      }
      next;
    }
    if ($in_code) {
      $q->{stem} .= "$line\n" if $q;
      next;
    }

    # 一级标题 = 题库名
    if ($trim =~ /^#\s+(.+)$/) {
      $bank->{title} = $1;
      next;
    }
    # 二级标题 = 章节
    if ($trim =~ /^##\s+(.+)$/) {
      my $title = $1;
      $title =~ s/\s+$//;
      push @{ $bank->{chapters} }, {
        id    => $meta->{id} . '-c' . (scalar @{ $bank->{chapters} } + 1),
        title => $title,
        order => scalar @{ $bank->{chapters} } + 1,
      };
      $chapter = $bank->{chapters}[-1];
      next;
    }
    # 文件头的题量声明，用于交叉核对
    if ($trim =~ /^>\s*共\s*(\d+)\s*题/) {
      $header_declared = $1;
      $bank->{subtitle} = $trim;
      $bank->{subtitle} =~ s/^>\s*//;
      next;
    }

    # 三级标题 = 一道题的开始
    if ($trim =~ /^###\s*(\d+)\s*[.、．]\s*(.*)$/) {
      $flush->();
      my ($no, $type_label) = ($1, $2);
      $type_label =~ s/\s+$//;
      my $type = $TYPE_MAP{$type_label};
      unless ($type) {
        issue(level => 'warn', bankId => $meta->{id}, questionNo => $no,
              code => 'unknown-type',
              message => "未知题型「$type_label」，已按单选题处理（请人工确认）");
        $type = 'single';
      }
      $q = {
        id        => $meta->{id} . '-' . $no,
        no        => $no + 0,
        bankId    => $meta->{id},
        chapterId => $chapter ? $chapter->{id} : undef,
        type      => $type,
        typeLabel => $type_label,
        stem      => '',
        options   => [],
        answer    => [],
        answerRaw => undef,
        explanation => undef,
        flags     => [],
      };
      $state = 'stem';
      next;
    }

    next unless $q;

    if ($state eq 'stem' || $state eq 'options') {
      if ($trim =~ /^-\s*([A-Za-z])\s*[.、．:：]\s*(.*)$/) {
        my ($key, $text) = (uc($1), $2);
        $text =~ s/\s+$//;
        push @{ $q->{options} }, { key => $key, text => $text };
        $state = 'options';
        next;
      }
    }

    if ($trim =~ /^\*\*答案\*\*\s*[：:]\s*(.*)$/) {
      my $raw = $1;
      $raw =~ s/\s+$//;
      $q->{answerRaw} = $raw;
      my @keys = map { uc($_) } grep { length } split /[、,，\/\s]+/, $raw;
      # 兼容 "ABD" 这种连写
      if (@keys == 1 && $raw =~ /^[A-Za-z]{2,}$/) {
        @keys = split //, uc($raw);
      }
      $q->{answer} = [@keys];
      $state = 'tail';
      next;
    }

    if ($trim =~ /^\*\*解析\*\*\s*[：:]\s*(.*)$/) {
      $q->{explanation} = $1;
      $state = 'tail';
      next;
    }

    if ($trim eq '---') {
      # 题目之间的分隔线；不主动 flush，等下一个 ### 再收尾（保持块内结构完整）
      next;
    }

    if ($state eq 'stem' || $state eq 'idle') {
      $q->{stem} .= "$line\n";
      next;
    }
    if ($state eq 'tail' && defined $q->{explanation}) {
      # 解析换行续写
      $q->{explanation} .= "\n$trim" if length $trim;
      next;
    }
    # 选项区里出现的其它行：可能是被折行的选项文本，也可能是干扰内容。
    if ($state eq 'options' && length $trim) {
      my $last = $q->{options}[-1];
      if ($last) {
        issue(level => 'info', bankId => $meta->{id}, questionNo => $q->{no},
              code => 'stray-line-in-options',
              message => "选项区出现非选项行，已并入最后一个选项：「$trim」");
        $last->{text} .= ' ' . $trim;
      }
    }
  }
  $flush->();

  # ---------- 校验 ----------
  my %seen_stem;
  for my $qq (@{ $bank->{questions} }) {
    my @keys = map { $_->{key} } @{ $qq->{options} };
    my %uniq; my @dup = grep { $uniq{$_}++ } @keys;
    push @{ $qq->{flags} }, { code => 'duplicate-option-key', detail => join('', @dup) } if @dup;

    if (!@keys) {
      push @{ $qq->{flags} }, { code => 'no-options' };
      issue(level => 'error', bankId => $meta->{id}, questionId => $qq->{id},
            code => 'no-options', message => "第 $qq->{no} 题没有解析出任何选项");
    }
    if (!defined $qq->{answerRaw} || !@{ $qq->{answer} }) {
      push @{ $qq->{flags} }, { code => 'missing-answer' };
      issue(level => 'error', bankId => $meta->{id}, questionId => $qq->{id},
            code => 'missing-answer', message => "第 $qq->{no} 题原始题库缺失答案，无法判分（保留原题，标记为不计分）");
    } else {
      my %opt = map { $_ => 1 } @keys;
      my @bad = grep { !$opt{$_} } @{ $qq->{answer} };
      if (@bad) {
        push @{ $qq->{flags} }, { code => 'answer-not-in-options', detail => join('', @bad) };
        issue(level => 'error', bankId => $meta->{id}, questionId => $qq->{id},
              code => 'answer-not-in-options',
              message => "第 $qq->{no} 题答案「$qq->{answerRaw}」不在选项（" . join('', @keys) . "）里，按原样保留但不计入得分");
      }
    }
    if ($qq->{type} eq 'multiple' && @{ $qq->{answer} } == 1 && defined $qq->{answerRaw}) {
      push @{ $qq->{flags} }, { code => 'multiple-single-answer' };
      issue(level => 'warn', bankId => $meta->{id}, questionId => $qq->{id},
            code => 'multiple-single-answer',
            message => "第 $qq->{no} 题标注为多选题但只有一个答案「$qq->{answerRaw}」");
    }
    if ($qq->{type} eq 'single' && @{ $qq->{answer} } > 1) {
      push @{ $qq->{flags} }, { code => 'single-multi-answer' };
      issue(level => 'warn', bankId => $meta->{id}, questionId => $qq->{id},
            code => 'single-multi-answer',
            message => "第 $qq->{no} 题标注为单选题但有多个答案「$qq->{answerRaw}」");
    }
    if (!defined $qq->{explanation} || $qq->{explanation} !~ /\S/) {
      push @{ $qq->{flags} }, { code => 'no-explanation' };
      issue(level => 'info', bankId => $meta->{id}, questionId => $qq->{id},
            code => 'no-explanation', message => "第 $qq->{no} 题没有解析");
    }
    if (!length $qq->{stem}) {
      push @{ $qq->{flags} }, { code => 'no-stem' };
      issue(level => 'error', bankId => $meta->{id}, questionId => $qq->{id},
            code => 'no-stem', message => "第 $qq->{no} 题题干为空");
    }
    my $norm = lc($qq->{stem});
    $norm =~ s/\s+//g;
    if (length $norm && $seen_stem{$norm}) {
      push @{ $qq->{flags} }, { code => 'duplicate-stem', detail => $seen_stem{$norm} };
      issue(level => 'info', bankId => $meta->{id}, questionId => $qq->{id},
            code => 'duplicate-stem',
            message => "第 $qq->{no} 题题干与第 $seen_stem{$norm} 题重复");
    }
    $seen_stem{$norm} //= $qq->{no};

    $qq->{scorable} = (@{ $qq->{flags} } == 0) ? 1 : 0;
    # scorable 只受"影响判分"的异常影响；无解析/重复题干不影响判分
    my %fatal = map { $_->{code} => 1 } @{ $qq->{flags} };
    $qq->{scorable} = ($fatal{'no-options'} || $fatal{'missing-answer'} ||
                       $fatal{'answer-not-in-options'} || $fatal{'no-stem'}) ? 0 : 1;
  }

  if (defined $header_declared && $header_declared != @{ $bank->{questions} }) {
    issue(level => 'warn', bankId => $meta->{id}, code => 'count-mismatch',
          message => "文件头声明 $header_declared 题，实际解析出 " . scalar(@{ $bank->{questions} }) . " 题");
  }

  # 章节题量
  for my $c (@{ $bank->{chapters} }) {
    $c->{questionCount} = scalar grep { ($_->{chapterId} // '') eq $c->{id} } @{ $bank->{questions} };
  }
  my $orphan = scalar grep { !defined $_->{chapterId} } @{ $bank->{questions} };
  if ($orphan) {
    issue(level => 'warn', bankId => $meta->{id}, code => 'orphan-questions',
          message => "有 $orphan 道题不在任何章节下");
  }

  $bank->{questionCount} = scalar @{ $bank->{questions} };
  $bank->{scorableCount} = scalar grep { $_->{scorable} } @{ $bank->{questions} };
  my %byType;
  $byType{ $_->{type} }++ for @{ $bank->{questions} };
  $bank->{typeCount} = \%byType;

  push @banks, $bank;
}

# ---------- 输出 ----------
my $data = {
  schema     => 1,
  generatedAt=> scalar(gmtime()) . ' UTC',
  source     => \@files,
  banks      => \@banks,
  issues     => \@issues,
};

make_path("$out_dir/js/data", "$out_dir/data");

my $json = encode_json($data);
# JSON 里不能出现裸的 </script>，否则内联进 <script> 会截断
(my $inline = $json) =~ s{</}{<\\/}g;

open(my $js, '>:encoding(UTF-8)', "$out_dir/js/data/banks.js") or die $!;
print $js "/* 自动生成，请勿手改 —— 由 tools/build_data.pl 从题库 Markdown 转换而来。 */\n";
print $js "/* 生成时间: $data->{generatedAt} */\n";
print $js "window.QUIZ_DATA = $inline;\n";
close($js);

open(my $jf, '>:encoding(UTF-8)', "$out_dir/data/banks.json") or die $!;
print $jf $json;
close($jf);

my $report = "# 题库转换报告\n\n生成时间：$data->{generatedAt}\n\n## 题量核对\n\n";
$report .= "| 题库 | 解析题数 | 可判分 | 章节 | 题型分布 |\n|---|---|---|---|---|\n";
for my $b (@banks) {
  my $t = join(' + ', map { "$_ $b->{typeCount}{$_}" } sort keys %{ $b->{typeCount} });
  $report .= "| $b->{title} | $b->{questionCount} | $b->{scorableCount} | " . scalar(@{ $b->{chapters} }) . " | $t |\n";
}
$report .= "\n## 数据异常清单\n\n";
if (!@issues) {
  $report .= "无。\n";
} else {
  my %lvl = (error => '错误', warn => '警告', info => '提示');
  $report .= "| 级别 | 题库 | 题目 | 类型 | 说明 |\n|---|---|---|---|---|\n";
  for my $it (@issues) {
    $report .= sprintf("| %s | %s | %s | `%s` | %s |\n",
      $lvl{ $it->{level} } // $it->{level},
      $it->{bankId} // '-',
      $it->{questionId} // ($it->{questionNo} ? "第 $it->{questionNo} 题" : '-'),
      $it->{code}, $it->{message});
  }
}
$report .= "\n> 说明：题目内容一律按原始 Markdown 原样保留，本脚本不做任何修正。\n" .
           "> 影响判分的异常题会在前端标记为「不计分」，但依然可以查看和作答。\n";

open(my $rf, '>:encoding(UTF-8)', "$out_dir/data/build-report.md") or die $!;
print $rf $report;
close($rf);

print "题库解析完成:\n";
for my $b (@banks) {
  printf "  %-6s %-16s 题数=%-4d 可判分=%-4d 章节=%d\n",
    $b->{id}, $b->{title}, $b->{questionCount}, $b->{scorableCount}, scalar @{ $b->{chapters} };
}
printf "  异常/提示条目: %d\n", scalar @issues;
print "  输出: js/data/banks.js, data/banks.json, data/build-report.md\n";

exit 0;

# ---- 极简 JSON 编码器（避免依赖 JSON::PP 之外的模块；这里直接用它，够用） ----
sub encode_json {
  my ($v) = @_;
  require JSON::PP;
  my $j = JSON::PP->new->utf8->canonical->allow_nonref;
  my $s = $j->encode($v);
  $s = decode('UTF-8', $s);
  # 让生成的文件更好读：数组里的对象逐个换行
  $s =~ s/\},\{/},\n{/g;
  return $s;
}
